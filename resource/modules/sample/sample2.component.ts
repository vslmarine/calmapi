import { Component, OnDestroy, OnInit } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { ConfigurationService, HttpRequestService, LocalStorageService } from 'src/app/core/services';
import { ConnectionService } from 'ng-connection-service';
import { IndexedDbService } from 'src/app/core/services/indexed-db.service';
import { SyncService } from 'src/app/core/services/sync.service';
import { Subscription } from 'rxjs';
import { GetAllTableReportsService } from 'src/app/core/services/get-all-table-reports.service';
import { ActivatedRoute, NavigationExtras, Router } from '@angular/router';
import { PdfService } from 'src/app/core/services/pdf.service';
import { PaginationService } from 'src/app/core/services/pagination.service';

@Component({
    selector: APP_MODULE,
    templateUrl: MODULE_HTML_COMPONENT,
    styleUrls: MODULE_SCSS,
})
export class MODULE_COMPONENT implements OnInit, OnDestroy {

    localUser: any;
    userToken: any;
    serverBaseUrl: string = '';
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // replace pdf url liner-insp-cyl-cons with your 
    pdfDownloadUrl: string = '/api/liner-insp-cyl-cons/pdf-export/';
    loading: boolean = false;
    totalDataCount: number = 0;
    pageSize: number = 10;
    pageIndex: number = 1;
    search: string = '';
    isConnected = true;
    noInternetConnection!: boolean;
    isOffline = 'false';
    isOnline: boolean;
    allReportsData: any;
    networkSubscription!: Subscription;
    offlineDrafts: any = [];

    // add draft type in getAllTableReportsService function
    draftType: string = this.getAllTableReportsService.getAllReportTypes;

    deleteApiSubscription!: Subscription;
    showReportInterval: any;

    // add indexed Report Name
    indexedDBReportName: string = '';

    constructor(
        private httpRequestService: HttpRequestService,
        private notificationService: NzNotificationService,
        private localStorageService: LocalStorageService,
        private configurationService: ConfigurationService,
        private indexedDbService: IndexedDbService,
        private syncService: SyncService,
        private connectionService: ConnectionService,
        private getAllTableReportsService: GetAllTableReportsService,
        private router: Router,
        private paginationService: PaginationService,
        private pdfService: PdfService,
        private route: ActivatedRoute
    ) {
        this.userToken = this.localStorageService.getItem('token', false);
        this.serverBaseUrl = this.configurationService.apiUrl;
        this.localUser = this.localStorageService.getItem('user');
        this.isOnline = false;
        this.updateOnlineStatus();
    }

    // network status check
    async updateOnlineStatus() {
        this.isOnline = window.navigator.onLine;
        if (this.isOnline) {
            this.noInternetConnection = false;
            this.isOffline = 'false';
            await this.syncService.syncData().then(() => {
                this.showReportInterval = setInterval(() => {
                    // this.loading = true;
                    if (this.syncService.allReportsSynced) {
                        this.getAllTableReports();
                        clearInterval(this.showReportInterval);
                    }
                }, 1000);
            });
        } else {
            this.noInternetConnection = true;
            this.isOffline = 'true';
            await this.getAllOfflineReports().then(() => {
                this.loading = false;
            });
        }
    }

    ngOnDestroy(): void {
        this.networkSubscription?.unsubscribe();
        if (this.showReportInterval) {
            clearInterval(this.showReportInterval);
        }
        const currentRoute = this.router.routerState.snapshot.url;

        // replace liner-inspection-table with your tablename
        if (!currentRoute.includes('liner-inspection-table') || currentRoute.includes('add')) {
            this.paginationService.setPageIndex(1);
            this.getAllTableReportsService.changePageSize(10);
            this.paginationService.setPageSize(10);
        }
    }

    ngOnInit(): void {
        this.paginationService.getPageIndex().subscribe((index: any) => {
            this.pageIndex = index;
        });
        this.paginationService.getPageSize().subscribe((size: any) => {
            this.pageSize = size;
        });
        this.userToken = this.localStorageService.getItem('token', false);
        this.serverBaseUrl = this.configurationService.apiUrl;
        this.localUser = this.localStorageService.getItem('user');

        this.networkSubscription = this.connectionService.monitor().subscribe((isConnected: any) => {
            this.isConnected = isConnected;
            this.updateOnlineStatus();
        });
    }

    getAllTableReports(skip = 0) {
        if (window.navigator.onLine) {
            this.loading = true;
            this.isOffline = 'false';
            this.noInternetConnection = false;

            // replace liner-insp-cyl-cons with your url
            this.allReportsData = this.getAllTableReportsService.getAllReportsWithDrafts(this.draftType, 'liner-insp-cyl-cons', skip).subscribe(async (data: any) => {
                if (data) {
                    this.allReportsData = data;
                    this.loading = false;
                } else {
                    await this.getAllOfflineReports().then(() => {
                        this.noInternetConnection = true;
                        this.isOffline = 'true';
                        this.loading = false;
                    });
                }
            },
                () => {
                    this.loading = false;
                }
            );
        }
    }

    /* For Pagination / Sending skip */
    onQueryParamsChange(params: NzTableQueryParams): void {
        const { pageSize, pageIndex } = params;
        if (this.pageIndex != pageIndex) {
            //   this.pageIndex = pageIndex;
            //   this.getAllTableReports(pageSize * (pageIndex - 1));
            this.paginationService.setPageIndex(pageIndex);
            this.paginationService.setPageSize(pageSize);
            this.getAllTableReports(pageSize * (pageIndex - 1));
            const navigationExtras: NavigationExtras = {
                state: {
                    pageIndex: pageIndex,
                },
            };
            this.router.navigate([], {
                relativeTo: this.route,
                ...navigationExtras,
            });
        }
    }

    // page size change
    pageSizeChange(event: any) {
        this.loading = true;
        this.getAllTableReportsService.changePageSize(event);
        this.paginationService.setPageSize(event);
        this.paginationService.setPageIndex(1);
        this.getAllTableReports();
    }

    /* delete*/
    delete(url: any, id: string): void {
        let reportDeletedOnline: boolean = false;
        const isDraft: boolean = url.toLowerCase().includes('draft');
        if (this.localUser?.Role == 'admin') {
            this.loading = true;
            setTimeout(async () => {
                if (!reportDeletedOnline) {
                    this.deleteApiSubscription?.unsubscribe();
                    let offlineID: boolean | number =
                        await this.syncService.getOfflineIdFromAnyID(id, this.indexedDBReportName, isDraft);
                    if (offlineID) {
                        const isDraft: boolean = url.toLowerCase().includes('draft');
                        await this.offlineDelete(offlineID, isDraft).then(() => {
                            this.loading = false;
                        });
                    }
                }
            }, 6000);
            this.deleteApiSubscription = this.httpRequestService.request('delete', `${url}${id}`).subscribe(async () => {
                reportDeletedOnline = true;
                this.notificationService.remove();
                this.notificationService.success('', 'Deleted Successfully');
                await this.syncService.syncData();
                let offlineID: boolean | number =
                    await this.syncService.getOfflineIdFromAnyID(id, this.indexedDBReportName, isDraft);
                if (offlineID) {
                    const showAllOnlineReports: boolean = true;
                    const isDraft: boolean = url.toLowerCase().includes('draft');
                    this.offlineDelete(offlineID, isDraft, showAllOnlineReports);
                }
                this.getAllTableReports();
            },
                async (error) => {
                    if (error.status == 404) {
                        let offlineID: boolean | number =
                            await this.syncService.getOfflineIdFromAnyID( id, this.indexedDBReportName, isDraft);
                        if (offlineID) {
                            const showAllOnlineReports: boolean = true;
                            this.offlineDelete(offlineID, isDraft, showAllOnlineReports);
                            this.getAllTableReports();
                        } else {
                            this.getAllTableReports();
                        }
                    } else {
                        this.getAllTableReports();
                    }
                }
            );
        }
    }

    downloadPDF(data: any) {

        // replace LinerInspec_Date with form date
        let pdfDate = data?.LinerInspec_Date;
        let onlyPdfDateSplit: string[] = pdfDate?.split('T')[0]?.split('-');
        pdfDate = onlyPdfDateSplit[2] + onlyPdfDateSplit[1] + onlyPdfDateSplit[0];
        data['pdfDate'] = pdfDate;
        this.pdfService.updatePdfData(data);

        // replace liner-insp-cyl-cond with your path
        this.router.navigateByUrl('/pdf/reportPdf/liner-insp-cyl-cond');
    }

    /* get all offline reports */
    async getAllOfflineReports() {

        // replace getLinerData with indexedDB function
        let result = await this.indexedDbService.getLinerData();

        // replace LinerInspec_Date with form date
        result.sort((a: any, b: any) => {
            const dateA: any = new Date(a.LinerInspec_Date);
            const dateB: any = new Date(b.LinerInspec_Date);
            return dateB - dateA;
        });

        let drafts: any = await this.getAllTableReportsService.getSpecificDraftArray(this.draftType);

        // replace LinerInspec_Date with form date
        drafts = drafts.sort((a: any, b: any) => {
            const dateA: any = new Date(a?.LinerInspec_Date);
            const dateB: any = new Date(b?.LinerInspec_Date);
            return dateB - dateA;
        });
        this.offlineDrafts = drafts;

        result = [...drafts, ...result];
        let isDraftArray: any[] = [];
        let apiUrlArray: any[] = [];
        result.forEach((res) => {
            isDraftArray.push({ isDraft: res.isDraft });
            // replace liner-insp-cyl-cons/ with your url
            apiUrlArray.push('liner-insp-cyl-cons/');
        });
        this.allReportsData = {
            allReports: result,
            isDraftArray: isDraftArray,
            apiUrlArray: apiUrlArray,
        };
        this.loading = false;
    }

    /* offline delete */
    async offlineDelete( id: any, isDraft?: boolean, showAllOnlineReports?: boolean ) {
        if (!isDraft) {
            await this.getDailyOfflineReportById(id, showAllOnlineReports ?? false);
        } else {
            await this.deleteDraftById(id, showAllOnlineReports ?? false);
        }
    }

    async getDailyOfflineReportById(id: any, showAllOnlineReports: boolean) {

        // replce getLinerDataById with your indexDB function
        let result = await this.indexedDbService.getLinerDataById(Number(id));
        result.syncType = 'delete';

        // replce updateLinerData with your indexDB function
        await this.indexedDbService.updateLinerData(id, result);
        this.notificationService.remove();
        this.notificationService.success('', 'Deleted Successfully');
        if (!showAllOnlineReports) {
            this.getAllOfflineReports();
        }
    }

    // Delete Draft
    async deleteDraftById(id: any, showAllOnlineReports?: boolean) {
        let result = await this.indexedDbService.getDraftDataById(Number(id));
        result.syncType = 'delete';
        this.getAllTableReportsService.updateOfflineDraftReort(
            Number(id),
            result,
            this.draftType
        );
        this.notificationService.remove();
        this.notificationService.success('', 'Deleted Successfully');
        await this.indexedDbService.addDeletedDraft(result);
        if (!showAllOnlineReports) {
            this.getAllOfflineReports();
        }
    }
}

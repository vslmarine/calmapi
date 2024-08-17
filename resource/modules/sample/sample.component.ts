import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { HttpRequestService, LocalStorageService, ConfigurationService } from 'src/app/core/services';
import { GeneralFunctionsService } from 'src/app/core/services/general-functions.service';
import { GetAllTableReportsService } from 'src/app/core/services/get-all-table-reports.service';
import { IndexedDbService } from 'src/app/core/services/indexed-db.service';
import { FormatDateTimeService } from 'src/app/core/services/format-date-time.service';
import { RangeValidationService } from 'src/app/core/services/range-validation.service';
import { SyncService } from 'src/app/core/services/sync.service';
import { Subject, Subscription } from 'rxjs';

@Component({
  selector: APP_MODULE,
  templateUrl: MODULE_HTML_COMPONENT,
  styleUrls: MODULE_SCSS
})
export class MODULE_COMPONENT implements OnInit, OnDestroy {

  MODULE_COMPONENT_FORM!: FormGroup;
  idForUpdate!: string;
  buttonLoading = false;
  loading = false;
  totalDataCount: any;
  localUser: any;
  isOnline!: boolean;
  editForm: boolean = false;
  offlineId: any;
  onlineId: any;
  softMandatoryArray: string[] = [];
  showCustomPopOver: boolean = false;
  canAddOrUpdate: any;
  DateTimeToBeFormatted: any
  // add draft type in getAllTableReportsService function
  draftType: string = this.getAllTableReportsService.getAllReportTypes;
  mediaPreviewUrl: any;
  indexedDBReportName: string = '';
  apiSubscriptionArray: Subscription[] = [];
  collectedDataFromApi: boolean = false;
  setTimeOutIDs: any[] = [];
  draftShouldSaveOffline: boolean = true;
  reportAlreadyAvailable: boolean = false;
  optionsObj: any = {};

  constructor(
    private fb: FormBuilder,
    private httpRequestService: HttpRequestService,
    private notificationService: NzNotificationService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private localStorageService: LocalStorageService,
    private indexedDbService: IndexedDbService,
    private getAllTableReportsService: GetAllTableReportsService,
    public generalFunctionsService: GeneralFunctionsService,
    private formatDateTimeService: FormatDateTimeService,
    private rangeValidationService: RangeValidationService,
    private syncService: SyncService,
    private configurationService: ConfigurationService,
  ) {
    this.localUser = this.localStorageService.getItem('user');
    this.idForUpdate = this.activatedRoute.snapshot.params.id;
    this.editForm = this.activatedRoute.snapshot.url[1].path == 'update';
    this.canAddOrUpdate = this.localUser.Role != 'reader';
    this.mediaPreviewUrl = this.configurationService.mediaBaseUrl;
    this.MODULE_COMPONENT_FORM = this.fb.group({
      IMO_No: [ this.localUser?.IMO_No ],
      MODULE_SCHEMA,
      {{#if data.InspectionData }}
      InspectionData: this.fb.array([]),
      {{/if}}
    })

    this.optionsObj = MODULE_OPTIONS_OBJ

    this.softMandatoryArray = MODULE_SOFT_MANDATORY

    this.updateOnlineStatus();
  }

  private updateOnlineStatus(): void {
    this.isOnline = window.navigator.onLine;
  }

  ngOnInit(): void {

    {{#if data.InspectionData }}
    this.addUnit(5)
    {{/if}}

    Object.keys(this.MODULE_COMPONENT_FORM.controls).forEach((controlName) => {
      const control = this.MODULE_COMPONENT_FORM.get(controlName);
      control?.valueChanges.subscribe(() => {
        if (!control.pristine) {
          this.highlightInvalidFields(controlName);
        }
      });
    });
  }

  {{#if data.InspectionData }}
  addUnit(unitNum: number) {

    for (let i = 0; i < unitNum ; i++) {
      this.InspectionDataArray.push(
        this.fb.group( SUB_MODULE_SCHEMA )
      );
    }
  }
  {{/if}}

  {{#if data.InspectionData }}
  get InspectionDataArray() {
    return this.MODULE_COMPONENT_FORM.get('InspectionData') as FormArray;
  }
  {{/if}}

  getReportById(): void {
    this.setTimeOutIDs.push(
      setTimeout(() => {
        if (!this.collectedDataFromApi) {
          this.unsubscribeAllApiRequests();
          this.getOfflineReportById();
        }
      }, 10000)
    );
    let updateUrl: string = this.editForm ? '' : 'drafts';
    this.apiSubscriptionArray.push(
      this.httpRequestService.request('get', `${updateUrl}/${this.idForUpdate}`).subscribe((res: any) => {
        this.collectedDataFromApi = true;
        this.onlineId = res?.data?._id;
        this.MODULE_COMPONENT_FORM.patchValue(res.data)
      })
    )

    this.MODULE_COMPONENT_FORM.patchValue(
      this.formatDateTimeService.patchReportAndFormatDateTimeWithTimeZone(this.MODULE_COMPONENT_FORM)
    )

  }

  async getOfflineReportById() {
    const isDraft: boolean = !this.editForm;

    const offlineID = await this.syncService.getOfflineIdFromAnyID(
      this.idForUpdate,
      this.indexedDBReportName,
      isDraft
    );

    if (offlineID) {

      // Change getRobDataById function in indexedDbService and uncomment code.

      // const result = this.editForm ? await this.indexedDbService.getRobDataById(offlineID) : await this.indexedDbService.getDraftDataById(offlineID);
      // this.onlineId = result?._id;
      // this.offlineId = result?.id;
      // this.MODULE_COMPONENT_FORM.patchValue(result);
      this.MODULE_COMPONENT_FORM.patchValue(
        this.formatDateTimeService.patchReportAndFormatDateTimeWithTimeZone(this.MODULE_COMPONENT_FORM)
      );

    } else {
      this.notificationService.remove();
      this.notificationService.error('Report loading interrupted', 'Please try again.');
      history.back();
    }
  }

  tsiNotifyMsg(): void {
    this.notificationService.remove();
    this.notificationService.error(
      '',
      "You don't have permission to access this resource"
    );
  }

  /* Make All Form Controls Dirty */
  private markFormGroupTouched(formGroup: FormGroup): void {
    for (const i in formGroup.controls) {
      if (formGroup.controls.hasOwnProperty(i)) {
        formGroup.controls[i].markAsDirty();
        formGroup.controls[i].updateValueAndValidity();
      }
    }
  }

  submit() {
    this.indexedDbService.hasSameDateTimeReport = false;
    this.buttonLoading = true;
    this.showCustomPopOver = false;
    if (!this.canAddOrUpdate) {
      this.tsiNotifyMsg();
      this.buttonLoading = false;
    } else {
      this.MODULE_COMPONENT_FORM.patchValue(this.generalFunctionsService.emptySpacesCheck(this.MODULE_COMPONENT_FORM));
      if (this.MODULE_COMPONENT_FORM.invalid) {
        this.markFormGroupTouched(this.MODULE_COMPONENT_FORM);
        this.buttonLoading = false;
      } else {
        this.reportAlreadyAvailable = false;
        this.generalFunctionsService.addReportUniqueId(this.MODULE_COMPONENT_FORM);
        if (!this.idForUpdate) {
          this.MODULE_COMPONENT_FORM.patchValue({ DateTimeToBeFormatted: true });
        }

        const sendFormObj = this.formatDateTimeService.submitFormattedDateTime(this.MODULE_COMPONENT_FORM);
        let previousStatus: boolean = this.isOnline;
        this.isOnline = window.navigator.onLine;

        if (this.isOnline && previousStatus) {
          this.setTimeOutIDs.push(
            setTimeout(async () => {
              if (!this.reportAlreadyAvailable) {
                this.unsubscribeAllApiRequests();
                await this.addOrUpdateOfflineData(sendFormObj).then(() => {
                  this.savedOfflineNotification();
                });
              }
            }, 10000)
          );
          this.addOrUpdateReport(
            sendFormObj,
            this.idForUpdate ? 'put' : 'post',
            `/${this.idForUpdate ?? ''}`,
            'Report Saved Successfully'
          );
        } else {
          this.addOrUpdateOfflineData(sendFormObj);
        }

      }
    }
  }

  savedOfflineNotification(isDraft?: boolean) {
    if (!this.indexedDbService.hasSameDateTimeReport) {
      this.notificationService.remove();
      if (isDraft) {
        this.notificationService.warning(
          'Draft Saved Successfully',
          'Draft will sync automatically when stable internet connection is available.'
        );
      } else {
        this.notificationService.warning(
          'Report Saved Successfully',
          'Report will sync automatically when stable internet connection is available.'
        );
      }
    }
  }

  async hasSameDateTime(dateTime: any): Promise<any[]> {
    const allReports = await this.indexedDbService.getTableReports(
      this.indexedDBReportName
    );
    let hasSameDateTimeArray: any[] = [];
    allReports.forEach((res: any) => {
      if (dateTime == res?.ROB_Report_Date) {
        hasSameDateTimeArray.push(res);
      }
    });
    return hasSameDateTimeArray;
  }

  async addOrUpdateReport(sendFormObj: any, requestMethod: string, requestURL: string, successMessage: string) {
    this.buttonLoading = true;
    this.apiSubscriptionArray.push(
      this.httpRequestService.request(requestMethod, requestURL, sendFormObj).subscribe(async (result: any) => {
        const noSync: boolean = true;
        await this.addOrUpdateOfflineData(sendFormObj, noSync, result.data._id);
        this.notificationService.success('', successMessage);
        this.deleteDraft();
        // add navigate url
        this.router.navigateByUrl('');
        this.buttonLoading = false;
      },
        (error: any) => {
          if (error?.error?.statusCode == 422) {
            this.reportAlreadyAvailable = true;
            this.notificationService.remove();
            this.notificationService.error('', error?.error?.message);
            this.buttonLoading = false;
          }
        }
      )
    );
  }

  async addOrUpdateOfflineData(sendFormObj: any, noSync?: boolean, onlineSavedID?: string | boolean) {
    if (this.editForm) {
      await this.offlineUpdateData(sendFormObj, noSync ?? false, onlineSavedID ?? false);
    } else {
      await this.offlineAddData(sendFormObj, noSync ?? false, onlineSavedID ?? false);
    }
  }

  deleteDraft() {
    if (this.activatedRoute.snapshot.url[1].path == 'draft') {
      this.httpRequestService.request('delete', `drafts/${this.idForUpdate}`).subscribe(
        () => {
          this.buttonLoading = false;
        },
        () => {
          this.buttonLoading = false;
        }
      );
    }
  }

  notifyDuplicateReport() {
    this.buttonLoading = false;
    this.notificationService.remove();
    this.notificationService.error(
      '',
      'Report already exists by this date and time.'
    );
  }

  draft() {
    let mandatoryControlnames: string[] = ['ROB_Report_Date'];
    mandatoryControlnames.forEach((control: string) => {
      this.MODULE_COMPONENT_FORM.get(control)?.markAsDirty();
      this.MODULE_COMPONENT_FORM.get(control)?.updateValueAndValidity();
    });
    if (
      this.generalFunctionsService.checkDateTimeForDraft(mandatoryControlnames, this.MODULE_COMPONENT_FORM)
    ) {
      this.buttonLoading = true;
      if (!this.canAddOrUpdate) {
        this.tsiNotifyMsg();
        this.buttonLoading = false;
      } else {
        this.draftShouldSaveOffline = true;
        this.generalFunctionsService.addReportUniqueId(this.MODULE_COMPONENT_FORM);
        if (!this.idForUpdate) {
          this.MODULE_COMPONENT_FORM.patchValue({
            DateTimeToBeFormatted: true,
          });
        }
        const sendFormObj = this.formatDateTimeService.submitFormattedDateTime(
          this.MODULE_COMPONENT_FORM
        );
        let previousStatus: boolean = this.isOnline;
        this.isOnline = window.navigator.onLine;

        if (this.isOnline && previousStatus) {
          this.setTimeOutIDs.push(
            setTimeout(async () => {
              if (this.draftShouldSaveOffline) {
                this.unsubscribeAllApiRequests();
                await this.offlineAddOrUpdateDraftValues(sendFormObj).then(
                  () => {
                    const isDraft: boolean = true;
                    this.savedOfflineNotification(isDraft);
                  }
                );
              }
            }, 10000)
          );
          this.addOrupdateDraftValues(
            sendFormObj,
            this.idForUpdate ? 'put' : 'post',
            `drafts/${this.idForUpdate ?? ''}`,
            'Draft Saved Sucessfully'
          );
        } else {
          this.offlineAddOrUpdateDraftValues(sendFormObj);
        }
      }
    }
  }

  addOrupdateDraftValues(sendFormObj: any, method: string, url: string, message: string) {
    let draftObj: any = { ...sendFormObj, reportType: this.draftType };

    this.apiSubscriptionArray.push(
      this.httpRequestService.request(method, url, draftObj).subscribe(
        async (result: any) => {
          const noSync: boolean = true;
          this.offlineAddOrUpdateDraftValues(sendFormObj, noSync, result.data._id);
          this.notificationService.success('', message);
          this.buttonLoading = false;
          history.back();
        },
        (error: any) => {
          if (error?.error?.statusCode == 422) {
            this.draftShouldSaveOffline = false;
            this.reportAlreadyAvailable = true;
            this.notificationService.remove();
            this.notificationService.error('', error?.error?.message);
            this.buttonLoading = false;
          }
        }
      )
    );
  }

  async offlineAddOrUpdateDraftValues(sendFormObj: any, noSync?: boolean, onlineSavedID?: string) {
    const isDraft: boolean = true;
    if (!noSync) {
      sendFormObj.syncType = this.idForUpdate && this.onlineId ? 'edit' : 'new';
    } else {
      if (!sendFormObj._id && onlineSavedID) {
        sendFormObj._id = onlineSavedID;
      }
      sendFormObj.syncType = null;
    }
    let offlineIDToBeSaved: any;
    if (this.idForUpdate) {
      offlineIDToBeSaved = await this.syncService.getOfflineIdFromAnyID(this.idForUpdate, this.indexedDBReportName, isDraft);
      if (!sendFormObj?._id?.length && !onlineSavedID?.length && this.onlineId?.length) {
        sendFormObj._id = this.onlineId;
      }
    }

    let draftObj: any = { ...sendFormObj, reportType: this.draftType };

    const processAfterSaving = () => {
      if (this.indexedDbService.hasSameDateTimeReport) {
        if (!noSync) {
          this.notifyDuplicateReport()
        }
      } else {
        if (!noSync) {
          const isDraft = true;
          this.savedOfflineNotification(isDraft);
          history.back();
        }
      }
    };

    const ida = !this.idForUpdate ? this.getAllTableReportsService.addOfflineDraftReport(draftObj, this.draftType).then(() => {
      processAfterSaving();
    }) : this.getAllTableReportsService.updateOfflineDraftReort(
      offlineIDToBeSaved,
      sendFormObj,
      this.draftType
    ).then(() => processAfterSaving());

    this.buttonLoading = false;
  }

  async offlineAddData(sendFormObj: any, noSync: boolean, onlineSavedID?: string | boolean) {
    this.buttonLoading = true;
    let data: any = sendFormObj;

    if (!noSync) {
      data.syncType = 'new';
    }
    if (!data._id && onlineSavedID) {
      data._id = onlineSavedID;
    }

    // update addRobData to your function in indexeddb service
    await this.indexedDbService.addRobData(data).then(async () => {
      if (this.indexedDbService.hasSameDateTimeReport) {
        this.notifyDuplicateReport();
      } else {
        const isDraft: boolean = true;
        const draftID = await this.syncService.getOfflineIdFromAnyID(this.idForUpdate, this.indexedDBReportName, isDraft);
        if (draftID) {
          let result = await this.indexedDbService.getDraftDataById(Number(draftID));
          result.syncType = 'delete';
          await this.indexedDbService.updateDraftData(Number(draftID), result);
          await this.indexedDbService.addDeletedDraft(result);
        }

        this.buttonLoading = false;
        if (!noSync) {
          this.savedOfflineNotification();

          // add navigate url
          this.router.navigateByUrl('');
        }
      }
    });

  }

  async offlineUpdateData(sendFormObj: any, noSync: boolean, onlineSavedID?: string | boolean) {
    this.buttonLoading = true;
    let updateData = sendFormObj;

    let offlineIdConfirmed: number | boolean = await this.syncService.getOfflineIdFromAnyID(this.idForUpdate, this.indexedDBReportName);

    if (offlineIdConfirmed) {
      if (!noSync) {
        updateData.syncType = this.onlineId ? 'edit' : 'new';
      }
      if (!updateData._id && onlineSavedID) {
        updateData._id = onlineSavedID;
      }

      // update updateRobData to your function in indexeddb service
      await this.indexedDbService.updateRobData(offlineIdConfirmed, updateData).then(() => {
        if (this.indexedDbService.hasSameDateTimeReport) {
          this.notifyDuplicateReport();
        } else {
          this.buttonLoading = false;
          if (!noSync) {
            this.savedOfflineNotification();
          }

          // add navigate url
          this.router.navigateByUrl('');
        }
      });
    }
  }

  highlightInvalidFields(event?: string) {
    if (event) {
      document.querySelectorAll('nz-select,input')?.forEach((inputBox) => {
        const element: any = inputBox;
        const controlName: string = element?.attributes?.formcontrolname?.value;
        const controlValue: any = this.MODULE_COMPONENT_FORM.get(controlName)?.value || element?.value;
        const isSoftMandatory: boolean = this.softMandatoryArray.includes(controlName);
        const isValid: boolean | undefined = element?.attributes?.class?.value?.includes('ng-valid') || (this.MODULE_COMPONENT_FORM.get(controlName)?.valid ?? true);
        const isTouched: boolean | undefined = !element?.attributes?.class?.value?.includes('ng-pristine');
        const isDropDown: boolean | undefined = element?.attributes?.class?.value?.includes('ant-select');

        if (isTouched && controlName) {
          if (isValid) {
            element.classList.remove('border-color-red');
            element.classList.remove('border-color-white');

            if ((!controlValue?.toString() || controlValue == '') && isSoftMandatory) {
              element.classList.add('border-color-green');
              if (isDropDown) {
                element?.childNodes[0].classList.add('noBorderWithFixedHeight');
              }
            } else {
              element.classList.remove('border-color-green');
              if (isDropDown) {
                element?.childNodes[0].classList.remove('noBorderWithFixedHeight');
              }
            }
          } else {
            if (isDropDown) {
              element?.childNodes[0].classList.remove('noBorderWithFixedHeight');
            }
          }
        }

      });
    } else {
      if (!this.canAddOrUpdate) {
        this.notificationService.error(
          '',
          "You don't have permission to access this resource"
        );
        this.buttonLoading = false;
      } else {
        this.generalFunctionsService.emptySpacesCheck(this.MODULE_COMPONENT_FORM);
        this.markFormGroupTouched(this.MODULE_COMPONENT_FORM);
        if (!this.generalFunctionsService.checkForAllImpFieldsFilled(this.MODULE_COMPONENT_FORM, this.softMandatoryArray)) {
          this.showCustomPopOver = true;
          document.querySelectorAll('nz-select,input')?.forEach((inputBox) => {
            const element: any = inputBox;
            const controlName: string = element?.attributes?.formcontrolname?.value;
            const controlValue: any = this.MODULE_COMPONENT_FORM.get(controlName)?.value || element?.value;
            const isSoftMandatory: boolean = this.softMandatoryArray.includes(controlName);
            const isValid: boolean | undefined = element?.attributes?.class?.value?.includes('ng-valid') || this.MODULE_COMPONENT_FORM.get(controlName)?.valid;
            const isDropDown: boolean | undefined = element?.attributes?.class?.value?.includes('ant-select');
            if (controlName) {
              if (isValid) {
                element.classList.remove('border-color-red');
                element.classList.remove('border-color-white');

                if ((!controlValue || controlValue == '') && isSoftMandatory) {
                  element.classList.add('border-color-green');
                  if (isDropDown) {
                    element?.childNodes[0].classList.add('noBorderWithFixedHeight');
                  }
                } else {
                  element.classList.remove('border-color-green');
                  if (isDropDown) {
                    element?.childNodes[0].classList.remove('noBorderWithFixedHeight');
                  }
                }
              } else {
                if (isDropDown) {
                  element?.childNodes[0].classList.remove('noBorderWithFixedHeight');
                }
              }
            }

          });
          this.buttonLoading = false;
        } else {
          this.buttonLoading = true;
          this.submit();
        }
      }
    }
  }

  returnRangeTooltipTitle(min: string | number, max: string | number): string {
    return `Value should be between ${min}  to ${max}`;
  }

  tooltipText(controlName: string): any {
    if (!this.MODULE_COMPONENT_FORM.get(controlName)?.pristine) {
      const returnValue = this.MODULE_COMPONENT_FORM.get(controlName)?.invalid && this.MODULE_COMPONENT_FORM.get(controlName)?.value?.toString().length > 0;
      return returnValue ? 'hover' : null;
    } else {
      return null;
    }
  }

  unsubscribeAllApiRequests() {
    this.apiSubscriptionArray.forEach((request) => {
      request.unsubscribe();
    });
  }

  clearAllTimeOuts() {
    this.setTimeOutIDs.forEach((timeOut) => {
      clearTimeout(timeOut);
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeAllApiRequests();
    this.clearAllTimeOuts();
  }

}
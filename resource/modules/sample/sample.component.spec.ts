import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MODULE_COMPONENT } from MODULE_NAME;

describe('MODULE_COMPONENT', () => {
  let component: MODULE_COMPONENT;
  let fixture: ComponentFixture<MODULE_COMPONENT>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MODULE_COMPONENT ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MODULE_COMPONENT);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
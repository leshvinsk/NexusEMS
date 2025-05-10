import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';

import { AdminAnalyticsComponent } from './admin-analytics.component';

describe('AdminAnalyticsComponent', () => {
  let component: AdminAnalyticsComponent;
  let fixture: ComponentFixture<AdminAnalyticsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AdminAnalyticsComponent ],
      imports: [ 
        RouterTestingModule,
        HttpClientTestingModule,
        FormsModule
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdminAnalyticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load analytics on init', () => {
    spyOn(component, 'loadAnalytics');
    component.ngOnInit();
    expect(component.loadAnalytics).toHaveBeenCalled();
  });

  it('should change analytic type', () => {
    spyOn(component, 'loadAnalytics');
    component.changeAnalyticType('events');
    expect(component.selectedAnalytic).toBe('events');
    expect(component.loadAnalytics).toHaveBeenCalled();
  });

  it('should change time filter', () => {
    spyOn(component, 'loadAnalytics');
    component.changeTimeFilter('last7days');
    expect(component.timeFilter).toBe('last7days');
    expect(component.loadAnalytics).toHaveBeenCalled();
  });
}); 
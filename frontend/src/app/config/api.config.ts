import { environment } from '../../environments/environment';

export const API_CONFIG = {
  BASE_URL: environment.apiBaseUrl,
  ENDPOINTS: {
    UPLOAD: '/upload',
    HISTORY: '/history',
    HISTORY_LATEST: '/history/latest',
    HISTORY_BY_ID: (id: number) => `/history/${id}`,
    REPORT_BY_ID: (id: number) => `/report/${id}`,
    RPH: '/rph',
    RPH_BY_ID: (id: number) => `/rph/${id}`,
    REVENUE_LATEST: '/revenue/latest'
  }
}; 
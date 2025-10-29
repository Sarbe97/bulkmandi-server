export interface IDashboardKPIs {
  openRfqs: number;
  quotesPendingAction: number;
  ordersToDispatch: number;
}

export interface IDashboardTask {
  type: string;
  completed: boolean;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface IRecentRfq {
  rfqId: string;
  product: string;
  quantity: string;
  incoterms: string;
  targetPin: string;
  status: string;
}

export interface IDashboardResponse {
  kpis: IDashboardKPIs;
  tasks: IDashboardTask[];
  recentRfqs: IRecentRfq[];
}

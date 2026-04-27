export interface DartCompanyInfo {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  corp_cls: string;
  sector: string;
  ceo_nm: string;
  adres: string;
  hm_url: string;
  ir_url: string;
  phn_no: string;
  fax_no: string;
  induty_code: string;
  est_dt: string;
  acc_mt: string;
}

export interface DartFinancialStatement {
  rcept_no: string;
  reprt_code: string;
  bsns_year: string;
  corp_code: string;
  sj_div: string;
  sj_nm: string;
  account_id: string;
  account_nm: string;
  account_detail: string;
  thstrm_nm: string;
  thstrm_amount: string;
  thstrm_add_amount: string;
  frmtrm_nm: string;
  frmtrm_amount: string;
  frmtrm_q_nm: string;
  frmtrm_q_amount: string;
  frmtrm_add_amount: string;
  bfefrmtrm_nm: string;
  bfefrmtrm_amount: string;
  ord: string;
  currency: string;
}

export interface DartDisclosure {
  corp_cls: string;
  corp_name: string;
  corp_code: string;
  stock_code: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  rcept_dt: string;
  rm: string;
}

export interface DartApiResponse<T> {
  status: string;
  message: string;
  list?: T[];
}

export interface DartCompanyResponse extends DartApiResponse<never> {
  corp_code: string;
  corp_name: string;
  stock_code: string;
  corp_cls: string;
  sector: string;
  ceo_nm: string;
  adres: string;
  hm_url: string;
  ir_url: string;
  phn_no: string;
  fax_no: string;
  induty_code: string;
  est_dt: string;
  acc_mt: string;
}

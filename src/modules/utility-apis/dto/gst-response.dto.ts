export class GstAddressDto {
  bnm?: string;
  loc: string;
  st: string;
  bno: string;
  stcd: string;
  dst: string;
  city?: string;
  flno?: string;
  lt?: string;
  pncd: string;
  lg?: string;
}

export class GstPrimaryAddressDto {
  addr: GstAddressDto;
  ntr: string;
}

export class GstTaxpayerInfoDto {
  stjCd?: string;
  lgnm: string;
  stj?: string;
  dty?: string;
  adadr?: any[];
  cxdt?: string;
  gstin: string;
  nba?: string[];
  rgdt?: string;
  ctb?: string;
  pradr?: GstPrimaryAddressDto;
  tradeNam?: string;
  sts: string;
  ctjCd?: string;
  ctj?: string;
  panNo?: string;
}

export class GstComplianceDto {
  filingFrequency?: string;
}

export class GstResponseDto {
  taxpayerInfo?: GstTaxpayerInfoDto;
  compliance?: GstComplianceDto;
  filing?: any[];
  error: boolean;
  message?: string;
}

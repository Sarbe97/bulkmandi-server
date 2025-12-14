export class PostOfficeDto {
  Name: string;
  Description?: string;
  BranchType: string;
  DeliveryStatus: string;
  Circle: string;
  District: string;
  Division: string;
  Region: string;
  Block?: string;
  State: string;
  Country: string;
  Pincode: string;
}

export class PincodeResponseDto {
  Message: string;
  Status: string;
  PostOffice: PostOfficeDto[];
}

import { Test, TestingModule } from '@nestjs/testing';
import { AdminOnboardingService } from './admin-onboarding.service';

describe('AdminOnboardingService', () => {
  let service: AdminOnboardingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminOnboardingService],
    }).compile();

    service = module.get<AdminOnboardingService>(AdminOnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

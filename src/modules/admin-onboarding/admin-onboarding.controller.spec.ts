import { Test, TestingModule } from '@nestjs/testing';
import { AdminOnboardingController } from './admin-onboarding.controller';

describe('AdminOnboardingController', () => {
  let controller: AdminOnboardingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminOnboardingController],
    }).compile();

    controller = module.get<AdminOnboardingController>(AdminOnboardingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

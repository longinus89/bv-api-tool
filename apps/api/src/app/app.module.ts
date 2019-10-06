import { Module, HttpModule } from '@nestjs/common';
import { FeaturesModule } from './features/features.module';

@Module({
  imports: [FeaturesModule, HttpModule]
})
export class AppModule {}

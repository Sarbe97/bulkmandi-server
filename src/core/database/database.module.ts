import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        // authSource: 'admin',
        onConnectionCreate: (connection) => {
          connection.on('connected', () => console.log('MongoDB connected'));
          connection.on('open', () => console.log('MongoDB open'));
          connection.on('disconnected', () => console.log('MongoDB disconnected'));
          connection.on('reconnected', () => console.log('MongoDB reconnected'));
          connection.on('disconnecting', () => console.log('MongoDB disconnecting'));

          connection.set('debug', configService.get<string>('MONGO_DB_LOG') == 'true');

          return connection;
        },
      }),
    }),
   
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}

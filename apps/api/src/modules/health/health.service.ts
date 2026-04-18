import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
  ) {}

  getHealthSnapshot() {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'ready' as const,
          env: this.configService.getOrThrow<string>('nodeEnv'),
        },
        database: {
          status: 'configured' as const,
          client: this.prismaService.constructor.name,
        },
        redis: {
          status: 'configured' as const,
          lazy: true,
          connectionStatus: this.redisService.getClient().status,
        },
        queues: {
          status: 'ready' as const,
          names: this.queueService.getRegisteredQueues().map((queue) => queue.name),
        },
        storage: {
          status: 'ready' as const,
          provider: this.storageService.getProvider(),
          bucket: this.storageService.getBucket(),
        },
      },
    };
  }
}

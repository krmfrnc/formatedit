import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis.service';

@Injectable()
export class DocumentRateLimitService {
  constructor(private readonly redisService: RedisService) {}

  async consume(userId: string, bucket: 'upload' | 'download' | 'api'): Promise<void> {
    const limits = {
      upload: { max: 20, ttlSeconds: 60 * 60 },
      download: { max: 60, ttlSeconds: 60 * 60 },
      api: { max: 300, ttlSeconds: 60 * 60 },
    } as const;

    const limit = limits[bucket];
    const client = this.redisService.getClient();
    const key = `rate-limit:${bucket}:${userId}`;
    const current = await client.incr(key);
    if (current === 1) {
      await client.expire(key, limit.ttlSeconds);
    }

    if (current > limit.max) {
      throw new HttpException(`Rate limit exceeded for ${bucket}`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}

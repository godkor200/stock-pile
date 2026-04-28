import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  NaverNewsResponse,
} from './interfaces/naver-response.interface';

const NAVER_API_BASE = 'https://openapi.naver.com';

@Injectable()
export class NaverNewsAdapter {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(NaverNewsAdapter.name);

  constructor(config: ConfigService) {
    const clientId = config.get<string>('NAVER_CLIENT_ID', '');
    const clientSecret = config.get<string>('NAVER_CLIENT_SECRET', '');

    this.http = axios.create({
      baseURL: NAVER_API_BASE,
      timeout: 10000,
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        this.logger.error('Naver News API request failed', err?.message);
        return Promise.reject(err);
      },
    );
  }

  async search(
    keyword: string,
    display = 10,
  ): Promise<NaverNewsResponse | null> {
    try {
      const { data } = await this.http.get<NaverNewsResponse>(
        '/v1/search/news.json',
        {
          params: {
            query: keyword,
            display,
            sort: 'date',
          },
        },
      );
      return data;
    } catch (err) {
      this.logger.error(`Naver news search failed for keyword=${keyword}`, err);
      return null;
    }
  }
}

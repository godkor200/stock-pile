import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatSessionEntity } from '@stock-pile/db-schema';
import { ChatSessionStatus, ParsedTradeFromChat } from '@stock-pile/shared-types';

const SESSION_TTL_MINUTES = 30;

@Injectable()
export class ChatSessionService {
  constructor(
    @InjectRepository(ChatSessionEntity)
    private readonly sessionRepo: Repository<ChatSessionEntity>,
  ) {}

  async create(userId: string, parsedData: ParsedTradeFromChat): Promise<ChatSessionEntity> {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000);
    const status = this.resolveStatus(parsedData);

    const session = this.sessionRepo.create({
      userId,
      parsedData,
      missingFields: parsedData.missingFields,
      status,
      expiresAt,
    });
    return this.sessionRepo.save(session);
  }

  async findActiveByUser(sessionId: string, userId: string): Promise<ChatSessionEntity> {
    const session = await this.sessionRepo.findOne({
      where: { sessionId, userId },
    });
    if (!session) throw new NotFoundException('세션을 찾을 수 없습니다');
    if (session.expiresAt < new Date()) throw new NotFoundException('세션이 만료되었습니다');
    return session;
  }

  async update(
    sessionId: string,
    userId: string,
    patch: Partial<ParsedTradeFromChat>,
    ticker?: string,
  ): Promise<ChatSessionEntity> {
    const session = await this.findActiveByUser(sessionId, userId);
    const updated: ParsedTradeFromChat = { ...session.parsedData, ...patch };
    if (ticker) updated.ticker = ticker;
    updated.missingFields = updated.missingFields.filter(
      (f) => updated[f as keyof ParsedTradeFromChat] !== undefined,
    );

    session.parsedData = updated;
    session.missingFields = updated.missingFields;
    session.status = this.resolveStatus(updated);
    return this.sessionRepo.save(session);
  }

  async confirm(sessionId: string, userId: string): Promise<ChatSessionEntity> {
    const session = await this.findActiveByUser(sessionId, userId);
    session.status = ChatSessionStatus.CONFIRMED;
    return this.sessionRepo.save(session);
  }

  private resolveStatus(parsed: ParsedTradeFromChat): ChatSessionStatus {
    if (parsed.missingFields.length > 0) return ChatSessionStatus.PENDING;
    return ChatSessionStatus.READY;
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatSessionStatus, ParsedTradeFromChat } from '@stock-pile/shared-types';
import { UserEntity } from './user.entity';

@Entity('chat_sessions')
@Index(['userId'])
export class ChatSessionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'session_id' })
  sessionId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'parsed_data', type: 'jsonb', default: '{}' })
  parsedData: ParsedTradeFromChat;

  @Column({ name: 'missing_fields', type: 'text', array: true, default: '{}' })
  missingFields: string[];

  @Column({ type: 'enum', enum: ChatSessionStatus, default: ChatSessionStatus.PENDING })
  status: ChatSessionStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.chatSessions)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}

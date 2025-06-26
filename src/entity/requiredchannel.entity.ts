// src/entity/RequiredChannelEntity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class RequiredChannel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string; // masalan: @mychannel
}

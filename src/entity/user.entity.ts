import { Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryColumn('bigint')
  id: string;
}

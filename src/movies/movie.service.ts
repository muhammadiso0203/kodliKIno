// src/movies/movie.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Movie } from 'src/entity/MovieEntity';
import { Repository } from 'typeorm';

@Injectable()
export class MovieService {
  constructor(
    @InjectRepository(Movie)
    private movieRepo: Repository<Movie>,
  ) {}

  create(code: string, title: string, file_id: string) {
    return this.movieRepo.save({ code, title, file_id });
  }

  findByCode(code: string) {
    return this.movieRepo.findOne({ where: { code } });
  }

  deleteByCode(code: string) {
    return this.movieRepo.delete({ code });
  }

  findAll() {
    return this.movieRepo.find();
  }
}

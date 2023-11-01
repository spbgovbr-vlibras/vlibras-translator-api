import db from '../models';
import mongoConnection from '../../util/mongoConnection';
import mongoose from 'mongoose';

mongoConnection();

// Definir esquemas do MongoDB
const hitSchema = new mongoose.Schema({
  text: String,
  hits: Number,
  createdAt: Date,
  updatedAt: Date
});

const reviewSchema = new mongoose.Schema({
  translationId: Number,
  rating: Boolean,
  review: String,
  requester: String,
  createdAt: Date,
  updatedAt: Date
});

const translationSchema = new mongoose.Schema({
  text: String,
  translation: String,
  requester: String,
  createdAt: Date,
  updatedAt: Date
});

// Definir modelos do MongoDB
const Hit = mongoose.model('Hit', hitSchema);
const Review = mongoose.model('Review', reviewSchema);
const Translation = mongoose.model('Translation', translationSchema);

// Definir modelos para PostgreSQL
const HitPostgres = db.Hit;
const ReviewPostgres = db.Translation;
const TranslationPostgres = db.Review;

// Migrar dados do MongoDB para o PostgreSQL
async function migrateData() {

  const hits = await Hit.find();
  const reviews = await Review.find();
  const translations = await Translation.find();

  await HitPostgres.bulkCreate(hits);
  await ReviewPostgres.bulkCreate(reviews);
  await TranslationPostgres.bulkCreate(translations);

  console.log('Dados migrados com sucesso.');
}

migrateData().catch(err => console.error('Ocorreu um erro durante a migração:', err));

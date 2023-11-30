import fs from 'fs';

// Importa os módulos necessários para trabalhar com o MongoDB, Mongoose e PostgreSQL
import db from '../models';
import mongoConnection from '../../util/mongoConnection';
import mongoose from 'mongoose';

// Estabelece a conexão com o MongoDB
mongoConnection();

// Define os esquemas para o MongoDB
const hitSchema = new mongoose.Schema({
  text: String,
  hits: Number,
  createdAt: Date,
  updatedAt: Date,
});

const reviewSchema = new mongoose.Schema({
  translationId: Number,
  rating: Boolean,
  review: String,
  requester: String,
  createdAt: Date,
  updatedAt: Date,
});

const translationSchema = new mongoose.Schema({
  text: String,
  translation: String,
  requester: String,
  createdAt: Date,
  updatedAt: Date,
});

// Define modelos para o MongoDB
const Hit = mongoose.model('Hit', hitSchema);
const Review = mongoose.model('Review', reviewSchema);
const Translation = mongoose.model('Translation', translationSchema);

// Define modelos para o PostgreSQL
const HitPostgres = db.Hit;
const ReviewPostgres = db.Review;
const TranslationPostgres = db.Translation;

// Função para migrar dados do MongoDB para o PostgreSQL
async function migrateData() {
  // Tamanho do lote (quantidade de documentos processados por vez)
  const batchSize = 100;

  // Migrar cada coleção do MongoDB para o PostgreSQL
  await migrateCollection(Hit, HitPostgres, batchSize, 'hitOffset.txt');
  await migrateCollection(Review, ReviewPostgres, batchSize, 'reviewOffset.txt');
  await migrateCollection(Translation, TranslationPostgres, batchSize, 'translationOffset.txt');

  const translatedData = await TranslationPostgres.findAll();
  console.log('Dados da coleção Translation no PostgreSQL:', translatedData);
  
}

// Função para migrar uma coleção específica
async function migrateCollection(SourceModel, DestinationModel, batchSize, offsetFileName) {
  // Lê o offset atual do arquivo ou define como 0 se o arquivo não existir
  let offset = readOffset(offsetFileName) || 0;

  // Loop de migração
  while (true) {
    // Obtém um lote de documentos da coleção de origem
    const items = await SourceModel.find().skip(offset).limit(batchSize);

    // Se não houver mais documentos, encerra o loop
    if (items.length === 0) break;

    // Insere o lote de documentos na coleção de destino
    await DestinationModel.bulkCreate(items);
    
    // Atualiza o offset e salva no arquivo
    offset += batchSize;
    saveOffset(offsetFileName, offset);
  }
}

// Função para ler o offset de um arquivo
function readOffset(offsetFileName) {
  try {
    return parseInt(fs.readFileSync(offsetFileName, 'utf8'));
  } catch (err) {
    // Retorna null se o arquivo não existir ou houver um erro na leitura
    return null;
  }
}

// Função para salvar o offset em um arquivo
function saveOffset(offsetFileName, offset) {
  fs.writeFileSync(offsetFileName, String(offset));
}

// Chama a função principal de migração de dados e trata erros
migrateData().catch((err) =>
  console.error('Ocorreu um erro durante a migração:', err)
);

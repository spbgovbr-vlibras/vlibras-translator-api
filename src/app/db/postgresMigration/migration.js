import fs from 'fs';

import db from '../models';
import mongoConnection from './mongoConnection';
import mongoose from 'mongoose';
import debug from 'debug';

const migrationInfo = debug('vlibras-migration:info');

mongoConnection();

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

const Hit = mongoose.model('Hit', hitSchema);
const Review = mongoose.model('Review', reviewSchema);
const Translation = mongoose.model('Translation', translationSchema);

const HitPostgres = db.Hit;
const ReviewPostgres = db.Review;
const TranslationPostgres = db.Translation;


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateData() {
  const batchSize = 1000;
  migrationInfo("Tamanho do lote: " + batchSize);

  await migrateCollection(Translation, TranslationPostgres, batchSize, 'lastid.txt', 'datacount.txt');

}

async function migrateCollection(SourceModel, DestinationModel, batchSize, lastIdFilename, dataCountFileName) {
  let lastId = readLastId(lastIdFilename) || 0;
  console.log(lastId)
  let dadosMigradosCount = readDataCount(dataCountFileName) || 0;;
  migrationInfo("Iniciando/Retomando migração. Quantidade de dados migrados: " + dadosMigradosCount + ' - Valor do último last id: ' + lastId);
  
  while (true) {

    const items = await SourceModel.find({ _id: { $gt: mongoose.Types.ObjectId(lastId) } })
    .sort({ _id: 1 })
    .limit(batchSize);

    if (items.length === 0) {
      migrationInfo("Sem novos dados para migrar. Valor total de dados migrados: " + dadosMigradosCount);
      break
    };

    const convertedData = items.map(({_doc}) => ({
      ..._doc,
      createdAt: _doc.createdAt.toISOString(),
      updatedAt: _doc.updatedAt.toISOString()
    }));
    
    await DestinationModel.bulkCreate(convertedData);
    
    lastId = items[items.length -1]._id;
    saveData(lastIdFilename, lastId);
    migrationInfo("Novo lastId: " + lastId);
    
    dadosMigradosCount = dadosMigradosCount + items.length
    saveData(dataCountFileName, dadosMigradosCount);
    migrationInfo(" Dados migrados até o momento: " + dadosMigradosCount);
    sleep(1000);
  }
}

function readDataCount(dataCountFileName) {
  try {
    return parseInt(fs.readFileSync(dataCountFileName, 'utf8'));
  } catch (err) {
    return null;
  }
}

function readLastId(lastIdFileName) {
  try {
    return String(fs.readFileSync(lastIdFileName, 'utf8')).trim();
  } catch (err) {
    return null;
  }
}

function saveData(fileName, data) {
  fs.writeFileSync(fileName, String(data));
}

migrateData().catch((err) =>
  console.error('Ocorreu um erro durante a migração:', err)
);

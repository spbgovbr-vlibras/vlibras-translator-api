import fs from 'fs';

// Importa os módulos necessários para trabalhar com o MongoDB, Mongoose e PostgreSQL
import db from '../models';
import mongoConnection from './mongoConnection';
import mongoose from 'mongoose';
import debug from 'debug';

const migrationInfo = debug('vlibras-migration:info');

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
  const batchSize = 1000;
  migrationInfo("Tamanho do lote: " + batchSize);

  // Migrar cada coleção do MongoDB para o PostgreSQL
  // await migrateCollection(Hit, HitPostgres, batchSize, 'hitOffset.txt');
  // await migrateCollection(Review, ReviewPostgres, batchSize, 'reviewOffset.txt');
  await migrateCollection(Translation, TranslationPostgres, batchSize, 'lastid.txt', 'datacount.txt');

// Para depuração
//   const translatedData = await TranslationPostgres.findAll();
//   console.log('Dados da coleção Translation no PostgreSQL:', translatedData);
  
}

// Função para migrar uma coleção específica
async function migrateCollection(SourceModel, DestinationModel, batchSize, lastIdFilename, dataCountFileName) {
  // Lê o offset atual do arquivo ou define como 0 se o arquivo não existir
  let lastId = readLastId(lastIdFilename) || 0;
  console.log(lastId)
  let dadosMigradosCount = readDataCount(dataCountFileName) || 0;;
  migrationInfo("Iniciando/Retomando migração. Quantidade de dados migrados: " + dadosMigradosCount + ' - Valor do último last id: ' + lastId);
  
  // Loop de migração
  while (true) {
  
    // Obtém um lote de documentos da coleção de origem
    //const items = await SourceModel.find().skip(lastId).limit(batchSize);
    const items = await SourceModel.find({ _id: { $gt: mongoose.Types.ObjectId(lastId) } })
    .sort({ _id: 1 })
    .limit(batchSize);

    // Se não houver mais documentos, encerra o loop
    if (items.length === 0) {
      migrationInfo("Sem novos dados para migrar. Valor total de dados migrados: " + dadosMigradosCount);
      break
    };

    const convertedData = items.map(({_doc}) => ({
      ..._doc,
      createdAt: _doc.createdAt.toISOString(),
      updatedAt: _doc.updatedAt.toISOString()
    }));
    
    // Insere o lote de documentos na coleção de destino
    await DestinationModel.bulkCreate(convertedData);
    
    // Atualiza o lastId e salva no arquivo
    //lastId += batchSize;
    lastId = items[items.length -1]._id;
    saveData(lastIdFilename, lastId);
    migrationInfo("Novo lastId: " + lastId);
    
    dadosMigradosCount = dadosMigradosCount + items.length
    saveData(dataCountFileName, dadosMigradosCount);
    migrationInfo(" Dados migrados até o momento: " + dadosMigradosCount);
  }
}

// Função para ler o número de dados já migrados de um arquivo
function readDataCount(dataCountFileName) {
  try {
    return parseInt(fs.readFileSync(dataCountFileName, 'utf8'));
  } catch (err) {
    // Retorna null se o arquivo não existir ou houver um erro na leitura
    return null;
  }
}

// Função para ler o último id de um arquivo
function readLastId(lastIdFileName) {
  try {
    return String(fs.readFileSync(lastIdFileName, 'utf8')).trim();
  } catch (err) {
    // Retorna null se o arquivo não existir ou houver um erro na leitura
    return null;
  }
}

// Função para salvar o offset em um arquivo
function saveData(fileName, data) {
  fs.writeFileSync(fileName, String(data));
}

// Chama a função principal de migração de dados e trata erros
migrateData().catch((err) =>
  console.error('Ocorreu um erro durante a migração:', err)
);

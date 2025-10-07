import { Sequelize, DataTypes } from 'sequelize';
import config from '../config/config.js';
import HitFactory from './hit.js';
import ReviewFactory from './review.js';
import TranslationFactory from './translation.js';

import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('vlibras-translator-api');

const env = process.env.NODE_ENV || 'dev';

const sequelizeConfig = config[env];
const db = {};

let sequelize;
{
  const initSpan = tracer.startSpan('sequelize.init', {
    attributes: { 'db.system': 'sequelize', 'app.component': 'db' },
  });
  try {
    if (sequelizeConfig.use_env_variable) {
      const s = tracer.startSpan('sequelize.new', { attributes: { 'db.system': 'sequelize', 'db.config': 'env_variable' } });
      sequelize = new Sequelize(process.env[sequelizeConfig.use_env_variable], sequelizeConfig);
      s.end();
    } else {
      const s = tracer.startSpan('sequelize.new', { attributes: { 'db.system': 'sequelize', 'db.config': 'inline' } });
      sequelize = new Sequelize(sequelizeConfig.database, sequelizeConfig.username, sequelizeConfig.password, sequelizeConfig);
      s.end();
    }
  } catch (e) {
    initSpan.recordException(e);
    initSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
    initSpan.end();
    throw e;
  }
  initSpan.end();
}

// Inicializa modelos
let Hit, Review, Translation;
{
  const modelsSpan = tracer.startSpan('sequelize.models.init', { attributes: { 'db.system': 'sequelize' } });
  try {
    const s1 = tracer.startSpan('model.init.Hit'); Hit = HitFactory(sequelize, DataTypes); s1.end();
    const s2 = tracer.startSpan('model.init.Review'); Review = ReviewFactory(sequelize, DataTypes); s2.end();
    const s3 = tracer.startSpan('model.init.Translation'); Translation = TranslationFactory(sequelize, DataTypes); s3.end();
  } catch (e) {
    modelsSpan.recordException(e);
    modelsSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
    modelsSpan.end();
    throw e;
  }
  modelsSpan.end();
}

// Configuração das associações
{
  const assocSpan = tracer.startSpan('sequelize.associations', { attributes: { 'db.system': 'sequelize' } });
  try {
    Translation.associate({ Translation, Review });
  } catch (e) {
    assocSpan.recordException(e);
    assocSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
    assocSpan.end();
    throw e;
  }
  assocSpan.end();
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default { sequelize, Sequelize, Hit, Review, Translation};

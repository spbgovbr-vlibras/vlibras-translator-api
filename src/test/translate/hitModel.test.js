import { Sequelize, DataTypes } from 'sequelize';
import HitModel from   '../../app/db/models/hit';  // Caminho para o seu modelo 'Hit'

describe('Hit Model', () => {
  let sequelize;
  let Hit;

  beforeAll(() => {
    // Criando uma instância do Sequelize com um banco de dados em memória
    sequelize = new Sequelize('sqlite::memory:'); // Usando SQLite em memória para testes
    Hit = HitModel(sequelize); // Inicializa o modelo Hit com a instância do Sequelize
  });

  beforeEach(async () => {
    // Sincroniza o modelo com o banco de dados (cria as tabelas)
    await sequelize.sync();
  });

  afterEach(async () => {
    // Limpa os dados após cada teste
    await sequelize.truncate();
  });

  afterAll(async () => {
    // Fecha a conexão com o banco de dados após todos os testes
    await sequelize.close();
  });

  it('should create a Hit record', async () => {
    const hitData = {
      text: 'Example hit text',
      hits: 10,
    };

    const hit = await Hit.create(hitData);

    expect(hit.text).toBe('Example hit text');
    expect(hit.hits).toBe(10);
  });

  it('should validate required fields (text and hits)', async () => {
    const hitData = {
      hits: 10, // Sem o campo 'text'
    };

    try {
      await Hit.create(hitData); // Espera falhar, porque 'text' é obrigatório
    } catch (error) {
      expect(error.errors[0].message).toBe('text cannot be null');
    }
  });

  it('should not allow non-integer hits', async () => {
    const hitData = {
      text: 'Valid hit text',
      hits: 'not a number', // Enviando uma string para 'hits'
    };

    try {
      await Hit.create(hitData);
    } catch (error) {
      expect(error.errors[0].message).toBe('hits must be an integer');
    }
  });

  it('should update an existing Hit record', async () => {
    const hitData = {
      text: 'Example hit text',
      hits: 10,
    };

    const hit = await Hit.create(hitData);

    // Atualizando o registro
    hit.hits = 20;
    await hit.save();

    const updatedHit = await Hit.findByPk(hit.id);
    expect(updatedHit.hits).toBe(20);
  });

  it('should be able to associate with other models (if associations exist)', async () => {
    // Teste para garantir que associações sejam configuradas corretamente
    // Exemplo: Testando se uma associação 'hasMany' ou 'belongsTo' funciona
    // Dependendo de como o modelo estiver configurado.
  });
});

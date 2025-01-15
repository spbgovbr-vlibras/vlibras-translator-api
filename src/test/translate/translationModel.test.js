import { Sequelize, DataTypes } from 'sequelize';
import TranslationModel from '../../app/db/models/translation';
import ReviewModel from '../../app/db/models/review';

describe('Translation Model', () => {
  let sequelize;
  let Translation;
  let Review;

  beforeAll(() => {
    sequelize = new Sequelize('sqlite::memory:');

    Translation = TranslationModel(sequelize);
    Review = ReviewModel(sequelize);

    Translation.hasMany(Review, { foreignKey: 'translationId' });
    Review.belongsTo(Translation, { foreignKey: 'translationId' });
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  afterEach(async () => {
    await sequelize.truncate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should create a Translation record', async () => {
    const translationData = {
      text: 'Original text',
      translation: 'Texto traduzido',
      requester: 'John Doe',
    };

    const translation = await Translation.create(translationData);

    expect(translation.text).toBe('Original text');
    expect(translation.translation).toBe('Texto traduzido');
    expect(translation.requester).toBe('John Doe');
  });

  it('should associate Translation with Review', async () => {
    const translationData = {
      text: 'Original text',
      translation: 'Texto traduzido',
      requester: 'John Doe',
    };
  
    const reviewData = {
      reviewText: 'Review text example', 
      rating: 5,
      reviewer: 'Jane Doe',
    };
  
    const translation = await Translation.create(translationData);
  
    await Review.create({
      ...reviewData,
      translationId: translation.id,
    });
  
    const associatedReviews = await Review.findAll({
      where: { translationId: translation.id },
    });
  
    expect(associatedReviews.length).toBe(1);
    expect(associatedReviews[0].reviewText).toBe();
  });  
});

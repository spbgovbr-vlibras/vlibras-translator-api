import { Sequelize, DataTypes } from 'sequelize';
import ReviewModel from   '../../app/db/models/review'; 

describe('Review Model', () => {
  let sequelize;
  let Review;

  beforeAll(() => {
    sequelize = new Sequelize('sqlite::memory:');
    Review = ReviewModel(sequelize); 
  });

  beforeEach(async () => {
    await sequelize.sync();
  });

  afterEach(async () => {
    await sequelize.truncate();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('should create a Review record', async () => {
    const reviewData = {
      translationId: 1,
      rating: true,
      review: 'Great translation!',
      requester: 'John Doe',
    };

    const review = await Review.create(reviewData);

    expect(review.translationId).toBe(1);
    expect(review.rating).toBe(true);
    expect(review.review).toBe('Great translation!');
    expect(review.requester).toBe('John Doe');
  });

  it('should validate required fields', async () => {
    const reviewData = {
      rating: true,
      review: 'Great translation!',
      requester: 'John Doe',
    };

    try {
      await Review.create(reviewData);
    } catch (error) {
      expect(error.errors[0].message).toBe('translationId cannot be null');
    }
  });

  it('should validate that rating is a boolean', async () => {
    const reviewData = {
      translationId: 1,
      rating: 'not a boolean', 
      review: 'Great translation!',
      requester: 'John Doe',
    };

    try {
      await Review.create(reviewData);
    } catch (error) {
      expect(error.errors[0].message).toBe('rating must be a boolean');
    }
  });

  it('should update an existing Review record', async () => {
    const reviewData = {
      translationId: 1,
      rating: true,
      review: 'Great translation!',
      requester: 'John Doe',
    };

    const review = await Review.create(reviewData);
    
    review.review = 'Excellent translation!';
    await review.save();

    const updatedReview = await Review.findByPk(review.id);
    expect(updatedReview.review).toBe('Excellent translation!');
  });

  it('should be able to associate with other models (if associations exist)', async () => {
    // Teste para garantir que associações sejam configuradas corretamente
    // Exemplo: Testando se uma associação 'hasMany' ou 'belongsTo' funciona
    // Dependendo de como o modelo estiver configurado.
  });
});

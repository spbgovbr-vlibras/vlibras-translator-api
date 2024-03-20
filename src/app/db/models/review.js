import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Review extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Review.init({
    translationId: DataTypes.INTEGER,
    rating: DataTypes.BOOLEAN,
    review: DataTypes.STRING(5000),
    requester: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Review',
  });
  return Review;
};
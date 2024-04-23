// review.js
import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Review extends Model {
    static associate(models) {
      // Define association here
    }
  }
  Review.init({
    translationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Translation',
        key: 'id'
      }
    },
    rating: DataTypes.BOOLEAN,
    review: DataTypes.STRING(5000),
    requester: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'Review',
    indexes: [
      {
        fields: ['translationId'] 
      }
    ]
  });
  return Review;
};

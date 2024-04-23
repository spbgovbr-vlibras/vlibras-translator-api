// hit.js
import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Hit extends Model {
    static associate(models) {
      // Define association here
    }
  }
  Hit.init({
    text: {
      type: DataTypes.STRING(5000),
      allowNull: false
    },
    hits: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Hit',
    indexes: [
      {
        fields: ['text'] // Adicionando índice na coluna 'text'
      }
    ]
  });
  return Hit;
};

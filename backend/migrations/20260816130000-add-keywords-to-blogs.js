import { DataTypes } from 'sequelize';

export default {
  up: async (queryInterface) => {
    await queryInterface.addColumn('blogs', 'primary_keywords', {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    }).catch(() => {});

    await queryInterface.addColumn('blogs', 'secondary_keywords', {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('blogs', 'primary_keywords').catch(() => {});
    await queryInterface.removeColumn('blogs', 'secondary_keywords').catch(() => {});
  }
};

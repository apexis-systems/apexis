import { DataTypes } from 'sequelize';

export default {
  up: async (queryInterface) => {
    // Add custom plan columns to plans table
    await queryInterface.addColumn('plans', 'is_custom', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }).catch(() => {});

    await queryInterface.addColumn('plans', 'organization_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    }).catch(() => {});

    await queryInterface.addColumn('plans', 'subscription_cycle', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'monthly',
    }).catch(() => {});

    await queryInterface.addColumn('plans', 'custom_notes', {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    }).catch(() => {});

    // Add pending_custom_plan_id to organizations table
    await queryInterface.addColumn('organizations', 'pending_custom_plan_id', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    }).catch(() => {});
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('plans', 'is_custom').catch(() => {});
    await queryInterface.removeColumn('plans', 'organization_id').catch(() => {});
    await queryInterface.removeColumn('plans', 'subscription_cycle').catch(() => {});
    await queryInterface.removeColumn('plans', 'custom_notes').catch(() => {});
    await queryInterface.removeColumn('organizations', 'pending_custom_plan_id').catch(() => {});
  }
};

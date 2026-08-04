'use strict';

/** @type {import('sequelize-cli').Migration} */
export default {
  async up(queryInterface, Sequelize) {
    // Add fields to plans
    await queryInterface.addColumn('plans', 'price_per_seat_monthly', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 159.00,
    });
    await queryInterface.addColumn('plans', 'price_per_seat_annually', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 99.00,
    });

    // Add fields to organizations
    await queryInterface.addColumn('organizations', 'seats_purchased', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn('organizations', 'price_per_seat', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 159.00,
    });

    // Add fields to transactions
    await queryInterface.addColumn('transactions', 'seats_purchased', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });
    await queryInterface.addColumn('transactions', 'price_per_seat', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 159.00,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('plans', 'price_per_seat_monthly');
    await queryInterface.removeColumn('plans', 'price_per_seat_annually');
    await queryInterface.removeColumn('organizations', 'seats_purchased');
    await queryInterface.removeColumn('organizations', 'price_per_seat');
    await queryInterface.removeColumn('transactions', 'seats_purchased');
    await queryInterface.removeColumn('transactions', 'price_per_seat');
  }
};

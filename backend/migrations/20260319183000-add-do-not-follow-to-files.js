'use strict';

export default {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('files', 'do_not_follow', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('files', 'do_not_follow');
    }
};

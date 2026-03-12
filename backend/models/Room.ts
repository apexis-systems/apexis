import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Room = sequelize.define(
        "rooms",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            type: {
                type: DataTypes.ENUM('direct', 'group'),
                defaultValue: 'direct',
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            organization_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: "rooms",
            timestamps: true,
        }
    );

    return Room;
};

import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Organization = sequelize.define(
        "organizations",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            logo: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            plan_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            plan_start_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            plan_end_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            storage_used_mb: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
        },
        {
            tableName: "organizations",
            timestamps: true,
        }
    );

    return Organization;
};

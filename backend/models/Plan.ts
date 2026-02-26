import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const Plan = sequelize.define(
        "plans",
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
            price: {
                type: DataTypes.DECIMAL,
                allowNull: false,
            },
            storage_limit_mb: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            duration_days: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: "plans",
            timestamps: true,
            createdAt: "created_at",
            updatedAt: "updated_at",
        }
    );

    return Plan;
};

import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const ProjectMember = sequelize.define(
        "project_members",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            project_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            role: {
                type: DataTypes.ENUM("contributor", "client"),
                allowNull: false,
            },
        },
        {
            tableName: "project_members",
            timestamps: true,
        }
    );

    return ProjectMember;
};

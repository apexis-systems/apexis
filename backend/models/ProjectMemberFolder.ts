import type { Sequelize } from "sequelize";
import { DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
    const ProjectMemberFolder = sequelize.define(
        "project_member_folders",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
                autoIncrement: true,
            },
            project_member_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            folder_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        },
        {
            tableName: "project_member_folders",
            timestamps: true,
        }
    );

    return ProjectMemberFolder;
};

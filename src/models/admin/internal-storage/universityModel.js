const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");
const University = {
    create: async (
        university_name,
        university_address,
        contact_name,
        designation,
        mobile_number,
        email_id,
        scope_of_services,
        pricing,
        turnaround_time,
        standard_process,
        verification_link,
        remark,
        callback
    ) => {
        // Step 1: Check if a university with the same name already exists
        const checkUniversitySql = `
          SELECT * FROM \`universities\` WHERE \`university_name\` = ?
        `;
        const universityResults = await sequelize.query(checkUniversitySql, {
            replacements: [university_name], // Positional replacements using ?
            type: QueryTypes.SELECT,
        });
        // Step 2: If a university with the same name exists, return an error
        if (universityResults.length > 0) {
            const error = new Error("University with the same name already exists");
            console.error(error.message);
            return callback(error, null);
        }

        // Step 3: Insert the new university record
        const insertUniversitySql = `
                      INSERT INTO \`universities\` (
                          \`university_name\`, \`university_address\`, \`contact_name\`, \`designation\`,
                          \`mobile_number\`, \`email_id\`, \`scope_of_services\`, \`pricing\`,
                          \`turnaround_time\`, \`standard_process\`, \`verification_link\`, \`remark\`
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
        const results = await sequelize.query(insertUniversitySql, {
            replacements: [university_name,
                university_address,
                contact_name,
                designation,
                mobile_number,
                email_id,
                scope_of_services,
                pricing,
                turnaround_time,
                standard_process,
                verification_link,
                remark], // Positional replacements using ?
            type: QueryTypes.INSERT,
        });
        callback(null, results);
    },

    list: async (callback) => {
        const sql = `
          SELECT * FROM \`universities\``;

      
            const results = await sequelize.query(sql, {
                type: QueryTypes.SELECT,
              });
                callback(null, results);
    },

    getById: async (id, callback) => {
        const sql = `SELECT * FROM \`universities\` WHERE \`id\` = ?`;
            const results = await sequelize.query(sql, {
                replacements: [id], // Positional replacements using ?
                type: QueryTypes.SELECT,
              });
                callback(null, results[0]);
    },

    update:async  (
        id,
        university_name,
        university_address,
        contact_name,
        designation,
        mobile_number,
        email_id,
        scope_of_services,
        pricing,
        turnaround_time,
        standard_process,
        verification_link,
        remark,
        callback
    ) => {
        const sql = `
          UPDATE \`universities\`
          SET
            \`university_name\` = ?,
            \`university_address\` = ?,
            \`contact_name\` = ?,
            \`designation\` = ?,
            \`mobile_number\` = ?,
            \`email_id\` = ?,
            \`scope_of_services\` = ?,
            \`pricing\` = ?,
            \`turnaround_time\` = ?,
            \`standard_process\` = ?,
            \`verification_link\` = ?,
            \`remark\` = ?
          WHERE \`id\` = ?
        `;

        const results = await sequelize.query(sql, {
            replacements: [university_name,
                university_address,
                contact_name,
                designation,
                mobile_number,
                email_id,
                scope_of_services,
                pricing,
                turnaround_time,
                standard_process,
                verification_link,
                remark, id], // Positional replacements using ?
            type: QueryTypes.UPDATE,
          });
                    callback(null, results);
             
        
    },

    delete:async  (id, callback) => {
        const sql = `
          DELETE FROM \`universities\`
          WHERE \`id\` = ?
        `;
            const results = await sequelize.query(sql, {
                replacements: [id], // Positional replacements using ?
                type: QueryTypes.DELETE,
              });
               
                callback(null, results);
    },
};

module.exports = University;

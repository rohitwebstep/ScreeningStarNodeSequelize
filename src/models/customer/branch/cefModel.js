const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");

const cef = {
  formJson: async (service_id, callback) => {

    const sql = "SELECT * FROM `cef_service_forms` WHERE `service_id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [service_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results);


  },

  formJsonWithData: async (services, candidate_application_id, callback) => {

    let completedQueries = 0;
    const serviceData = {}; // Initialize an object to store data for each service.

    // Helper function to check completion
    const checkCompletion = () => {
      if (completedQueries === services.length) {

        callback(null, serviceData);
      }
    };

    // Step 1: Loop through each service and perform actions
    services.forEach(async (service) => {
      const query =
        "SELECT `json` FROM `cef_service_forms` WHERE `service_id` = ?";


      const result = await sequelize.query(query, {
        replacements: [service], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      if (result.length > 0) {
        try {
          // Parse the JSON data
          const rawJson = result[0].json;
          const sanitizedJson = rawJson
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
          const jsonData = JSON.parse(sanitizedJson);
          const dbTable = jsonData.db_table;

          const sql = `SELECT * FROM \`cef_${dbTable}\` WHERE \`candidate_application_id\` = ?`;
          const dbTableResults = await sequelize.query(sql, {
            replacements: [candidate_application_id], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });
          const dbTableResult =
            dbTableResults.length > 0 ? dbTableResults[0] : null;
          serviceData[service] = {
            jsonData,
            data: dbTableResult,
          };

          completedQueries++;
          checkCompletion();

        } catch (parseErr) {
          console.error(
            "Error parsing JSON for service:",
            service,
            parseErr
          );
          completedQueries++;
          checkCompletion();
        }
      } else {
        console.warn(`No JSON found for service: ${service}`);
        completedQueries++;
        checkCompletion();
      }

    });

  },

  getCMEFormDataByApplicationId: async (
    candidate_application_id,
    db_table,
    callback
  ) => {

    const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?`;
    const tableResults = await sequelize.query(checkTableSql, {
      replacements: [process.env.DB_NAME, db_table], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (tableResults[0].count === 0) {
      const createTableSql = `
            CREATE TABLE \`${db_table}\` (
              \`id\` int NOT NULL AUTO_INCREMENT,
              \`cef_id\` int NOT NULL,
              \`candidate_application_id\` int NOT NULL,
              \`branch_id\` int(11) NOT NULL,
              \`customer_id\` int(11) NOT NULL,
              \`status\` VARCHAR(100) DEFAULT NULL,
              \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`candidate_application_id\` (\`candidate_application_id\`),
              KEY \`cef_application_customer_id\` (\`customer_id\`),
              KEY \`cef_application_cef_id\` (\`cef_id\`),
              CONSTRAINT \`fk_${db_table}_candidate_application_id\` FOREIGN KEY (\`candidate_application_id\`) REFERENCES \`candidate_applications\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_cef_id\` FOREIGN KEY (\`cef_id\`) REFERENCES \`cef_applications\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      await sequelize.query(createTableSql, {
        type: QueryTypes.CREATE,
      });
      fetchData();
    } else {
      fetchData();
    }

    async function fetchData() {
      const sql = `SELECT * FROM \`${db_table}\` WHERE \`candidate_application_id\` = ?`;
      const results = await sequelize.query(sql, {
        replacements: [candidate_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      const response = results.length > 0 ? results[0] : null;
      callback(null, response);
    }
  },

  getCEFApplicationById: async (
    candidate_application_id,
    branch_id,
    customer_id,
    callback
  ) => {

    const sql =
      "SELECT * FROM `cef_applications` WHERE `candidate_application_id` = ? AND `branch_id` = ? AND `customer_id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [candidate_application_id, branch_id, customer_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);


  },

  create: async (
    personal_information,
    candidate_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    // If personal_information is null, undefined, or an empty object, return success
    if (!personal_information || Object.keys(personal_information).length === 0) {
      return callback(null, { success: true, message: "No data to process." });
    }
    const fields = Object.keys(personal_information).map((field) =>
      field.toLowerCase()
    );
    const checkColumnsSql = `SHOW COLUMNS FROM \`cef_applications\``;
    const results = await sequelize.query(checkColumnsSql, {
      type: QueryTypes.SELECT,
    });

    const existingColumns = results.map((row) => row.Field);
    const missingColumns = fields.filter(
      (field) => !existingColumns.includes(field)
    );

    if (missingColumns.length > 0) {
      const alterQueries = missingColumns.map((column) => {
        return `ALTER TABLE cef_applications ADD COLUMN ${column} LONGTEXT`;
      });

      const alterPromises = alterQueries.map(
        (query) =>
          new Promise(async (resolve,) => {
            await sequelize.query(query, {
              type: QueryTypes.RAW,
            });
            resolve();
          })
      );

      Promise.all(alterPromises)
        .then(() => {
          cef.insertOrUpdateEntry(
            personal_information,
            candidate_application_id,
            branch_id,
            customer_id,
            callback
          );
        })
        .catch((alterErr) => {
          console.error("Error executing ALTER statements:", alterErr);

          callback(alterErr, null);
        });
    } else {
      cef.insertOrUpdateEntry(
        personal_information,
        candidate_application_id,
        branch_id,
        customer_id,
        callback
      );
    }


  },


  insertOrUpdateEntry: async (
    personal_information,
    candidate_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    try {
      const checkEntrySql =
        "SELECT id FROM cef_applications WHERE candidate_application_id = ?";
      const entryResults = await sequelize.query(checkEntrySql, {
        replacements: [candidate_application_id],
        type: QueryTypes.SELECT,
      });

      if (entryResults.length > 0) {
        // Entry exists → Update it
        personal_information.branch_id = branch_id;
        personal_information.customer_id = customer_id;

        // Convert personal_information object to SQL SET format
        const updateFields = Object.keys(personal_information)
          .map((key) => `${key} = ?`)
          .join(", ");

        const updateSql = `UPDATE cef_applications SET ${updateFields} WHERE candidate_application_id = ?`;
        const updateValues = [...Object.values(personal_information), candidate_application_id];

        await sequelize.query(updateSql, {
          replacements: updateValues,
          type: QueryTypes.UPDATE,
        });

        callback(null, { insertId: entryResults[0].id, result: "Updated Successfully" });
      } else {
        // Entry does not exist → Insert it
        const columns = Object.keys(personal_information)
          .concat(["candidate_application_id", "branch_id", "customer_id"])
          .join(", ");

        const placeholders = Object.keys(personal_information)
          .concat(["candidate_application_id", "branch_id", "customer_id"])
          .map(() => "?")
          .join(", ");

        const insertSql = `INSERT INTO cef_applications (${columns}) VALUES (${placeholders})`;
        const insertValues = [
          ...Object.values(personal_information),
          candidate_application_id,
          branch_id,
          customer_id,
        ];

        const insertResult = await sequelize.query(insertSql, {
          replacements: insertValues,
          type: QueryTypes.INSERT,
        });

        callback(null, insertResult);
      }
    } catch (error) {
      callback(error, null);
    }
  },


  createOrUpdateAnnexure: async (
    raw_cef_id,
    candidate_application_id,
    branch_id,
    customer_id,
    db_table,
    mainJson,
    callback
  ) => {
    const fields = Object.keys(mainJson).map((field) => field.toLowerCase());

    const checkTableSql = `
            SELECT COUNT(*) AS count 
            FROM information_schema.tables 
            WHERE table_schema = ? AND table_name = ?`;

    const tableResults = await sequelize.query(checkTableSql, {
      replacements: [process.env.DB_NAME, db_table], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (tableResults[0].count === 0) {
      const createTableSql = `
                    CREATE TABLE \`${db_table}\` (
                        \`id\` int NOT NULL AUTO_INCREMENT,
                        \`cef_id\` int NOT NULL,
                        \`candidate_application_id\` int NOT NULL,
                        \`branch_id\` int(11) NOT NULL,
                        \`customer_id\` int(11) NOT NULL,
                        \`status\` VARCHAR(100) DEFAULT NULL,
                        \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                        \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (\`id\`),
                        KEY \`candidate_application_id\` (\`candidate_application_id\`),
                        KEY \`branch_id\` (\`branch_id\`),
                        KEY \`cmt_application_customer_id\` (\`customer_id\`),
                        KEY \`cmt_application_cef_id\` (\`cef_id\`),
                        CONSTRAINT \`fk_${db_table}_candidate_application_id\` FOREIGN KEY (\`candidate_application_id\`) REFERENCES \`candidate_applications\` (\`id\`) ON DELETE CASCADE,
                        CONSTRAINT \`fk_${db_table}_branch_id\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\` (\`id\`) ON DELETE CASCADE,
                        CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
                        CONSTRAINT \`fk_${db_table}_cef_id\` FOREIGN KEY (\`cef_id\`) REFERENCES \`cmt_applications\` (\`id\`) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      await sequelize.query(createTableSql, {
        type: QueryTypes.CREATE,
      });
      proceedToCheckColumns();

    } else {
      proceedToCheckColumns();
    }

    async function proceedToCheckColumns() {
      const checkColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;
      const cefIDByCandidateID = `SELECT id from cef_applications where candidate_application_id = ?`;

      const results = await sequelize.query(checkColumnsSql, {
        type: QueryTypes.SELECT,
      });

      const cefIDResult = await sequelize.query(cefIDByCandidateID, {
        replacements: [candidate_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });

      cef_id = cefIDResult[0].id || null;

      const existingColumns = results.map((row) => row.Field);
      const missingColumns = fields.filter(
        (field) => !existingColumns.includes(field)
      );

      // 4. Add missing columns
      if (missingColumns.length > 0) {
        const alterQueries = missingColumns.map((column) => {
          return `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`; // Adjust data type as necessary
        });

        // Run all ALTER statements in sequence
        const alterPromises = alterQueries.map(
          (query) =>
            new Promise(async (resolve, reject) => {
              await sequelize.query(query, {
                type: QueryTypes.RAW,
              });
              resolve();

            })
        );

        Promise.all(alterPromises)
          .then(() => checkAndUpdateEntry())
          .catch((alterErr) => {
            console.error(
              "Error executing ALTER statements:",
              alterErr
            );

            callback(alterErr, null);
          });
      } else {
        checkAndUpdateEntry();
      }


    }

    async function checkAndUpdateEntry() {
      try {
        // 1. Check if entry exists by candidate_application_id
        const checkEntrySql = `SELECT * FROM \`${db_table}\` WHERE candidate_application_id = ?`;
        const entryResults = await sequelize.query(checkEntrySql, {
          replacements: [candidate_application_id],
          type: QueryTypes.SELECT,
        });
    
        // Clean up mainJson: trim strings and remove empty strings
        Object.keys(mainJson).forEach((key) => {
          if (typeof mainJson[key] === "string") {
            mainJson[key] = mainJson[key].trim();
            if (mainJson[key] === "") delete mainJson[key];
          }
        });
    
        if (entryResults.length > 0) {
          // 2. Entry exists: Generate update query
          const updateFields = Object.keys(mainJson)
            .map((key) => `\`${key}\` = ?`)
            .join(", ");
          
          const updateValues = [...Object.values(mainJson), candidate_application_id];
          
          const updateSql = `UPDATE \`${db_table}\` SET ${updateFields} WHERE candidate_application_id = ?`;
          const updateResult = await sequelize.query(updateSql, {
            replacements: updateValues,
            type: QueryTypes.UPDATE,
          });
    
          return callback(null, updateResult);
        } else {
          // 3. Entry doesn't exist: Insert new row
          // Ensure these fields exist in mainJson
          mainJson.candidate_application_id = candidate_application_id;
          mainJson.branch_id = branch_id;
          mainJson.customer_id = customer_id;
          mainJson.cef_id = cef_id;
    
          const insertFields = Object.keys(mainJson);
          const insertPlaceholders = insertFields.map(() => "?").join(", ");
          const insertValues = insertFields.map((field) => mainJson[field] || null);
    
          const insertSql = `INSERT INTO \`${db_table}\` (${insertFields.join(", ")}) VALUES (${insertPlaceholders})`;
    
          const insertResult = await sequelize.query(insertSql, {
            replacements: insertValues,
            type: QueryTypes.INSERT,
          });
    
          return callback(null, insertResult);
        }
      } catch (error) {
        console.error("Database operation failed:", error);
        return callback(error);
      }
    }
    
  },

  updateSubmitStatus: async (data, callback) => {
    const { candidateAppId, status } = data;

    const sql1 = `
        UPDATE \`cef_applications\` 
        SET \`is_submitted\` = ?
        WHERE \`candidate_application_id\` = ?;
    `;

    const sql2 = `
        UPDATE \`candidate_applications\` 
        SET \`is_submitted\` = ?
        WHERE \`id\` = ?;
    `;


    const results1 = await sequelize.query(sql1, {
      replacements: [status, candidateAppId], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    const results2 = await sequelize.query(sql2, {
      replacements: [status, candidateAppId], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, { cefResults: results1, candidateResults: results2 });
  },

  unsubmittedApplications: async (callback) => {
    const dayInterval = 1;
    const sql = `
    SELECT 
        ca.id AS candidate_application_id, 
        ca.name AS application_name, 
        ca.email, 
        ca.branch_id, 
        ca.customer_id,
        ca.services, 
        c.name AS customer_name, 
        b.name AS branch_name,
        COALESCE(cef.is_submitted, NULL) AS cef_submitted,
        COALESCE(da.is_submitted, NULL) AS dav_submitted
    FROM candidate_applications ca
    INNER JOIN customers c ON c.id = ca.customer_id
    INNER JOIN branches b ON b.id = ca.branch_id
    LEFT JOIN cef_applications cef ON cef.candidate_application_id = ca.id
    LEFT JOIN dav_applications da ON da.candidate_application_id = ca.id
    WHERE 
        -- Condition 1: Candidate applications not present in cef_applications OR present but not submitted
        (cef.candidate_application_id IS NULL OR cef.is_submitted = 0)
        -- Condition 2: Candidate applications not present in dav_applications OR present but not submitted
        AND (da.candidate_application_id IS NULL OR da.is_submitted = 0)
        -- Condition 3: Last reminder sent exactly 'dayInterval' days ago OR is NULL
        AND (
            (ca.cef_last_reminder_sent_at = DATE_SUB(CURDATE(), INTERVAL ? DAY) OR ca.cef_last_reminder_sent_at IS NULL)
            OR
            (ca.dav_last_reminder_sent_at = DATE_SUB(CURDATE(), INTERVAL ? DAY) OR ca.dav_last_reminder_sent_at IS NULL)
        )
        -- Condition 4: Only select candidates who have received less than 3 reminders
        AND ca.reminder_sent < 3
        AND c.is_deleted != 1
        AND ca.is_submitted != 2;
`;

    const results = await sequelize.query(sql, {
      replacements: [dayInterval, dayInterval], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results);

  },

  filledOrUnfilledServices: async (servicesIds, candidate_application_id, callback) => {
    if (!servicesIds) {
      return callback(null, {});
    }
    let services = Array.isArray(servicesIds) ? servicesIds : servicesIds.split(',').map(s => s.trim());
    if (!Array.isArray(services) || services.length === 0) {
      return callback(null, {}); // Return empty if no services are provided
    }


    let completedQueries = 0;
    const serviceData = {}; // Store data for each service.

    // Helper function to check completion
    const checkCompletion = () => {
      if (completedQueries === services.length) {

        callback(null, serviceData);
      }
    };

    services.forEach(async (service, index) => {
      const query = "SELECT `json` FROM `cef_service_forms` WHERE `service_id` = ?";
      const result = await sequelize.query(query, {
        replacements: [service], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });

      if (result.length === 0) {
        console.warn(`No JSON found for service: ${service}`);
        completedQueries++;
        return checkCompletion();
      }

      const rawJson = result[0].json;
      const sanitizedJson = rawJson
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'");
      const jsonData = JSON.parse(sanitizedJson);

      const dbTable = jsonData.db_table || null;
      const heading = jsonData.heading || `Service ${service}`;

      if (!dbTable) {
        console.warn(`Missing db_table for service: ${service}`);
        serviceData[service] = { heading, is_submitted: false };
        completedQueries++;
        return checkCompletion();
      }

      const sql = `SELECT is_submitted FROM \`cef_${dbTable}\` WHERE \`candidate_application_id\` = ?`;
      const dbTableResults = await sequelize.query(sql, {
        replacements: [candidate_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      const isSubmitted = dbTableResults.length > 0 && dbTableResults[0].is_submitted === 1;
      serviceData[service] = { heading, is_submitted: isSubmitted };
      completedQueries++;
      checkCompletion();


    });

  },

  updateReminderDetails: async (data, callback) => {
    const { candidateAppId } = data;

    const updateSQL = `
      UPDATE \`candidate_applications\` 
      SET 
        \`cef_last_reminder_sent_at\` = CURDATE(),
        \`dav_last_reminder_sent_at\` = CURDATE(),
        \`reminder_sent\` = reminder_sent + 1
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(updateSQL, {
      replacements: [candidateAppId], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });


    callback(null, results);


  },

  upload: async (
    cef_id,
    candidate_application_id,
    db_table,
    db_column,
    savedImagePaths,
    callback
  ) => {

    const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?`;
    const tableResults = await sequelize.query(checkTableSql, {
      replacements: [db_table], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (tableResults[0].count === 0) {
      const createTableSql = `
          CREATE TABLE \`${db_table}\` (
              \`id\` BIGINT(20) NOT NULL AUTO_INCREMENT,
              \`cef_id\` BIGINT(20) NULL,
              \`candidate_application_id\` BIGINT(20) NOT NULL,
              \`branch_id\` INT(11) NOT NULL,
              \`customer_id\` INT(11) NOT NULL,
              \`status\` VARCHAR(100) DEFAULT NULL,
              \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`candidate_application_id\` (\`candidate_application_id\`),
              KEY \`customer_id\` (\`customer_id\`),
              KEY \`cef_id\` (\`cef_id\`),
              CONSTRAINT \`fk_${db_table}_candidate_application_id\` FOREIGN KEY (\`candidate_application_id\`) 
                  REFERENCES \`candidate_applications\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) 
                  REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_cef_id\` FOREIGN KEY (\`cef_id\`) 
                  REFERENCES \`cef_applications\` (\`id\`) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await sequelize.query(createTableSql, {
        type: QueryTypes.CREATE,
      });
      proceedToCheckColumns();
    } else {
      proceedToCheckColumns();
    }

    async function proceedToCheckColumns() {
      const currentColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;
      const results = await sequelize.query(currentColumnsSql, {
        type: QueryTypes.SELECT,
      });

      const existingColumns = results.map((row) => row.Field);
      const expectedColumns = [db_column];
      const missingColumns = expectedColumns.filter(
        (column) => !existingColumns.includes(column)
      );

      const addColumnPromises = missingColumns.map((column) => {
        return new Promise(async (resolve, reject) => {
          const alterTableSql = `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`;
          await sequelize.query(alterTableSql, {
            type: QueryTypes.RAW,
          });
          resolve();


        });
      });

      Promise.all(addColumnPromises)
        .then(async () => {
          const fetchCEFDataSQL = `SELECT branch_id, customer_id FROM \`candidate_applications\` WHERE id = ?`;
          const candidateApplicationResults = await sequelize.query(fetchCEFDataSQL, {
            replacements: [candidate_application_id], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });

          if (!candidateApplicationResults.length) {
            console.error("Error: Candidate Application not found.");

            return callback({ message: "Candidate Application not found." }, null);
          }

          const branch_id = candidateApplicationResults[0].branch_id;
          const customer_id = candidateApplicationResults[0].customer_id;

          const checkEntrySql = `SELECT * FROM \`${db_table}\` WHERE candidate_application_id = ?`;
          const entryResults = await sequelize.query(checkEntrySql, {
            replacements: [candidate_application_id], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });


          const joinedPaths = savedImagePaths.join(", ");

          if (entryResults.length > 0) {
            const updateSql = `UPDATE \`${db_table}\` SET \`${db_column}\` = ? WHERE \`candidate_application_id\` = ?`;
            console.log("updateSql:", updateSql);
            const results = await sequelize.query(updateSql, {
              replacements: [joinedPaths, candidate_application_id], // Positional replacements using ?
              type: QueryTypes.UPDATE,
            });
            callback(true, results);

          } else {
            // Insert new record
            const insertSql = `INSERT INTO \`${db_table}\` (\`branch_id\`, \`customer_id\`,\`${db_column}\`, \`candidate_application_id\`) VALUES (?, ?, ?, ?)`;
            console.log("insertSql:", insertSql);
            const insertResult = await sequelize.query(insertSql, {
              replacements: [branch_id, customer_id, joinedPaths, candidate_application_id], // Positional replacements using ?
              type: QueryTypes.INSERT,
            });
            callback(true, insertResult);

          }

        })
        .catch((columnErr) => {

          console.error("Error adding columns:", columnErr);
          callback(false, {
            error: "Error adding columns.",
            details: columnErr,
          });
        });



    }


  },

  getAttachmentsByClientAppID: async (candidate_application_id, callback) => {
    try {
      const sql = "SELECT `services` FROM `candidate_applications` WHERE `id` = ?";
      const results = await sequelize.query(sql, {
        replacements: [candidate_application_id],
        type: QueryTypes.SELECT,
      });
  
      if (results.length === 0) return callback(null, []);
  
      const services = results[0].services.split(",");
      const dbTableFileInputs = {};
  
      // Step 1: Get file input names per service
      for (const service of services) {
        const query = "SELECT `json` FROM `cef_service_forms` WHERE `service_id` = ?";
        const result = await sequelize.query(query, {
          replacements: [service],
          type: QueryTypes.SELECT,
        });
  
        if (result.length > 0) {
          try {
            const jsonData = JSON.parse(result[0].json);
            const dbTable = jsonData.db_table;
  
            if (!dbTableFileInputs[dbTable]) {
              dbTableFileInputs[dbTable] = [];
            }
  
            jsonData.inputs.forEach((row) => {
              if (row.type === "file") {
                dbTableFileInputs[dbTable].push(row.name);
              }
            });
          } catch (err) {
            console.error(`JSON parse error for service ${service}:`, err);
          }
        }
      }
  
      // Step 2: Fetch host
      const hostSql = `SELECT \`cloud_host\` FROM \`app_info\` WHERE \`status\` = 1 AND \`interface_type\` = ? ORDER BY \`updated_at\` DESC LIMIT 1`;
      const hostResults = await sequelize.query(hostSql, {
        replacements: ["backend"],
        type: QueryTypes.SELECT,
      });
  
      const host = hostResults.length > 0 ? hostResults[0].cloud_host : "www.example.com";
  
      // Step 3: Fetch attachments from each db table
      const finalAttachments = [];
  
      for (const [dbTable, fileInputNames] of Object.entries(dbTableFileInputs)) {
        const selectQuery = `SELECT ${fileInputNames.length > 0 ? fileInputNames.join(", ") : "*"} FROM cef_${dbTable} WHERE candidate_application_id = ?`;
  
        const rows = await sequelize.query(selectQuery, {
          replacements: [candidate_application_id],
          type: QueryTypes.SELECT,
        });
  
        for (const row of rows) {
          const attachments = Object.values(row)
            .filter((value) => value)
            .join(",");
  
          attachments.split(",").forEach((attachment) => {
            finalAttachments.push(`${attachment}`);
          });
        }
      }
  
      // Step 4: Callback with final result
      callback(null, finalAttachments.join(", "));
    } catch (error) {
      console.error("Error in getAttachmentsByClientAppID:", error);
      callback(error);
    }
  }
  
};
module.exports = cef;

const CandidateMasterTrackerModel = require("../models/admin/candidateMasterTrackerModel");
const Admin = require("../models/admin/adminModel");
const Branch = require("../models/customer/branch/branchModel");
const CEF = require("../models/customer/branch/cefModel");
const Customer = require("../models/customer/customerModel");
const AppModel = require("../models/appModel");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const {
    upload,
    saveImage,
    saveImages,
    savePdf,
} = require("../utils/cloudImageSave");

const LogoBgv = path.join(__dirname, '../../Images/LogoBgv.jpg');

/**
 * Checks if an image exists by making a HEAD request.
 * @param {string} url - Image URL.
 * @returns {Promise<boolean>} - True if image exists, otherwise false.
 */
async function checkImageExists(url) {
    try {
        const response = await axios.head(url);
        return response.status >= 200 && response.status < 300;
    } catch (error) {
        // console.error(`❌ Error checking image existence: ${url}`, error.message);
        return false;
    }
}

/**
 * Validates the image and retrieves metadata.
 * @param {string} url - Image URL.
 * @returns {Promise<Object|null>} - Image metadata or null if invalid.
 */
async function validateImage(url) {
    try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        if (response.status !== 200 || !response.data) {
            // console.warn(`⚠️ Image fetch failed: ${url} (Status: ${response.status})`);
            return null;
        }

        const buffer = Buffer.from(response.data);
        const metadata = await sharp(buffer).metadata();
        if (!metadata) {
            // console.warn(`⚠️ No metadata found for image: ${url}`);
            return null;
        }

        return {
            src: url,
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            buffer: buffer,
        };
    } catch (error) {
        // console.error(`❌ Error validating image: ${url}`, error.message);
        return null;
    }
}

/**
 * Fetches an image or an array of images and converts them to Base64.
 * @param {string|string[]} imageUrls - Image URL(s).
 * @returns {Promise<Object[]|null>} - Array of Base64 image data or null on failure.
 */
async function fetchImageToBase(imageUrls) {
    try {
        // console.log("🔄 Starting fetchImageToBase function...");
        const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
        // console.log("✅ Image URLs received:", urls);

        const results = [];

        for (const imageUrl of urls) {
            // console.log("🔍 Processing image:", imageUrl);

            if (imageUrl.startsWith("http") || imageUrl.startsWith("https")) {
                // console.log("🌐 Detected as a URL, checking if image exists...");

                if (!(await checkImageExists(imageUrl))) {
                    // console.warn(`⚠️ Image does not exist: ${imageUrl}`);
                    continue;
                }

                // console.log("✅ Image exists, validating...");
                const imgData = await validateImage(imageUrl);

                if (!imgData) {
                    // console.warn(`⚠️ Validation failed for image: ${imageUrl}`);
                    continue;
                }

                // console.log("✅ Image validated successfully, processing Base64 conversion...");
                results.push({
                    imageUrl: imgData.src,
                    base64: `data:image/${imgData.format};base64,${imgData.buffer.toString("base64")}`,
                    type: imgData.format,
                    width: imgData.width,
                    height: imgData.height,
                });

                // console.log("🎉 Image processed successfully:", imgData.src);
            } else {
                // console.log("📂 Detected as a local file, normalizing path...");
                const normalizedPath = path.resolve(imageUrl.replace(/\\/g, "/"));
                // console.log("📝 Normalized Path:", normalizedPath);

                if (fs.existsSync(normalizedPath)) {
                    // console.log("✅ File exists, reading...");
                    const imageBuffer = fs.readFileSync(normalizedPath);
                    // console.log("✅ Successfully read file, converting to Base64...");
                    return `data:image/png;base64,${imageBuffer.toString("base64")}`;
                } else {
                    // console.error(`❌ Error: Local file not found -> ${normalizedPath}`);
                    return null;
                }
            }
        }

        // console.log("🏁 Processing complete. Returning results...");
        return results.length > 0 ? results : null;
    } catch (error) {
        // console.error(`❌ Error fetching images as Base64:`, error.message);
        return null;
    }
}

function calculateDateGap(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
        return null; // Return null for negative gaps (startDate is later than endDate)
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    return { years: Math.abs(years), months: Math.abs(months) };
}

function calculateDateDifference(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);

    if (isNaN(d1) || isNaN(d2)) return "Invalid Date";

    // Check if date1 is greater than or equal to date2
    if (d1 >= d2) return "No gap";

    let years = d2.getFullYear() - d1.getFullYear();
    let months = d2.getMonth() - d1.getMonth();
    let days = d2.getDate() - d1.getDate();

    if (days < 0) {
        months--;
        days += new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    return `${years > 0 ? years + " year(s) " : ""}${months > 0 ? months + " month(s) " : ""}${days > 0 ? days + " day(s)" : ""}`.trim();
}

function calculateGaps(annexureData) {
    // console.log("Received annexureData:", annexureData);

    const secondaryEndDate = annexureData?.gap_validation?.education_fields?.secondary?.secondary_end_date_gap || null;
    // console.log("secondaryEndDate:", secondaryEndDate);

    const seniorSecondaryStartDate = annexureData?.gap_validation?.education_fields?.senior_secondary?.senior_secondary_start_date_gap || null;
    // console.log("seniorSecondaryStartDate:", seniorSecondaryStartDate);

    const seniorSecondaryEndDate = annexureData?.gap_validation?.education_fields?.senior_secondary?.senior_secondary_end_date_gap || null;
    // console.log("seniorSecondaryEndDate:", seniorSecondaryEndDate);

    const graduationStartDate = annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_start_date_gap || null;
    // console.log("graduationStartDate:", graduationStartDate);

    const graduationEndDate = annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_end_date_gap || null;
    // console.log("graduationEndDate:", graduationEndDate);

    const postGraduationStartDate = annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_start_date_gap || null;
    // console.log("postGraduationStartDate:", postGraduationStartDate);

    const postGraduationEndDate = annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_end_date_gap || null;
    // console.log("postGraduationEndDate:", postGraduationEndDate);

    const phdStartDate = annexureData?.gap_validation?.education_fields?.phd_1?.phd_start_date_gap || null;
    // console.log("phdStartDate:", phdStartDate);

    const validGaps = {
        gapSecToSrSec: calculateDateGap(secondaryEndDate, seniorSecondaryStartDate),
        gapSrSecToGrad: calculateDateGap(seniorSecondaryEndDate, graduationStartDate),
        gapGradToPostGrad: calculateDateGap(graduationEndDate, postGraduationStartDate),
        gapPostGradToPhd: calculateDateGap(postGraduationEndDate, phdStartDate)
    };
    // console.log("Calculated validGaps:", validGaps);

    const nonNegativeGaps = Object.fromEntries(
        Object.entries(validGaps).filter(([_, value]) => value !== null)
    );
    // console.log("Filtered nonNegativeGaps:", nonNegativeGaps);

    function getEmploymentDates(data) {
        // console.log("Extracting employment dates from:", data);

        const employmentStartDates = [];
        const employmentEndDates = [];
        let i = 1;
        const employmentValues = data?.gap_validation?.employment_fields;

        if (!employmentValues) {
            // console.log("No employment fields found.");
            return { employmentStartDates, employmentEndDates };
        }

        while (true) {
            const employmentKey = `employment_${i}`;
            const employmentData = employmentValues[employmentKey];

            if (!employmentData) break;

            if (employmentData.employment_start_date_gap) {
                employmentStartDates.push({
                    name: `employment_start_date_gap_${i}`,
                    value: employmentData.employment_start_date_gap
                });
                // console.log(`Added employment start date:`, employmentStartDates[employmentStartDates.length - 1]);
            }
            if (employmentData.employment_end_date_gap) {
                employmentEndDates.push({
                    name: `employment_end_date_gap_${i}`,
                    value: employmentData.employment_end_date_gap
                });
                // console.log(`Added employment end date:`, employmentEndDates[employmentEndDates.length - 1]);
            }
            i++;
        }

        return { employmentStartDates, employmentEndDates };
    }

    const { employmentStartDates, employmentEndDates } = getEmploymentDates(annexureData);
    // console.log("Extracted employmentStartDates:", employmentStartDates);
    // console.log("Extracted employmentEndDates:", employmentEndDates);

    function getEmploymentDateDifferences(startDates, endDates) {
        // console.log("Calculating employment date differences...");
        return endDates.map((endDate, i) => {
            const nextStart = startDates[i + 1]?.value || null;
            // console.log(`Processing endDate: ${endDate.value}, nextStart: ${nextStart}`);

            if (endDate.value && nextStart && endDate.value !== nextStart) {
                const diff = calculateDateDifference(endDate.value, nextStart);
                // console.log(`Gap found: ${endDate.value} to ${nextStart} - Difference:`, diff);
                return {
                    endName: endDate.name,
                    endValue: endDate.value,
                    startName: startDates[i + 1].name,
                    startValue: nextStart,
                    difference: diff
                };
            }
            return null;
        }).filter(Boolean);
    }

    const employmentGaps = getEmploymentDateDifferences(employmentStartDates, employmentEndDates);
    // console.log("Final employment gaps:", employmentGaps);
    return { employGaps: employmentGaps, gaps: nonNegativeGaps };
}

function createEmploymentFields(noOfEmployments, fieldValue) {
    let employmentFieldsData = fieldValue.employment_fields;

    // Check if it's a string (i.e., it's been stringified previously) and parse it
    if (typeof employmentFieldsData === 'string') {
        employmentFieldsData = JSON.parse(employmentFieldsData);
    }

    const employmentFields = {}; // Initialize the employmentFields object to store all employment data

    // Dynamically structure the data like: employment_1, employment_2, etc.
    for (let i = 1; i <= noOfEmployments; i++) {
        const employmentData = employmentFieldsData[`employment_${i}`] || {};

        employmentFields[`employment_${i}`] = {
            employment_type_gap: employmentData.employment_type_gap || '',
            employment_start_date_gap: employmentData.employment_start_date_gap || '',
            employment_end_date_gap: employmentData.employment_end_date_gap || '',
        };
    }

    return employmentFields;
}

function updateEmploymentFields(annexureData, noOfEmployments, fieldValue) {
    // Generate new employment fields based on the provided number of employments
    const allEmploymentFields = createEmploymentFields(noOfEmployments, fieldValue);

    // Create a copy of the current annexureData
    const updatedAnnexureData = { ...annexureData };

    // Check if gap_validation exists before modifying
    if (updatedAnnexureData.gap_validation) {
        // Delete the existing employment_fields key
        delete updatedAnnexureData.gap_validation.employment_fields;
    } else {
        // If gap_validation doesn't exist, initialize it
        updatedAnnexureData.gap_validation = {};
    }

    // Add the new employment_fields data
    updatedAnnexureData.gap_validation.highest_education_gap = fieldValue.highest_education_gap;
    updatedAnnexureData.gap_validation.no_of_employment = fieldValue.no_of_employment;
    updatedAnnexureData.gap_validation.years_of_experience_gap = fieldValue.years_of_experience_gap;
    updatedAnnexureData.gap_validation.education_fields = JSON.parse(fieldValue.education_fields);
    updatedAnnexureData.gap_validation.employment_fields = allEmploymentFields;

    return updatedAnnexureData; // This can be used for further handling if needed
}

module.exports = {
    candidateFormPDF: async (
        candidate_applicaton_id,
        branch_id,
        customer_id,
        pdfFileName,
        targetDirectory
    ) => {
        return new Promise((resolve, reject) => {
            // console.log(`DEBUG: Calling applicationListByBranchByCandidateID for ID: ${candidate_applicaton_id}`);

            CandidateMasterTrackerModel.applicationListByBranchByCandidateID(
                candidate_applicaton_id,
                branch_id,
                async (err, application) => {
                    if (err) {
                        // console.error("Database error:", err);
                        return reject(new Error(`Database error: ${err.message}`));
                    }

                    if (!application) {
                        // console.warn("Application not found");
                        return reject(new Error("Application not found"));
                    }

                    // console.log(`application - `, application);

                    // console.log(`Step 1: Application data fetched for ID: ${candidate_applicaton_id}`);

                    CandidateMasterTrackerModel.applicationByID(
                        candidate_applicaton_id,
                        branch_id,
                        (err, application) => {
                            if (err) {
                                reject(
                                    new Error(err.message)
                                );
                            }

                            if (!application) {
                                reject(
                                    new Error("Application not found")
                                );
                            }
                            // console.log(`application - `, application);
                            const service_ids = Array.isArray(application.services)
                                ? application.services
                                : application.services.split(",").map((item) => item.trim());

                            CandidateMasterTrackerModel.cefApplicationByID(
                                candidate_applicaton_id,
                                branch_id,
                                (err, CEFApplicationData) => {
                                    if (err) {
                                        // console.error("Database error:", err);
                                        reject(
                                            new Error(err.message)
                                        );
                                    }

                                    Branch.getBranchById(branch_id, (err, currentBranch) => {
                                        if (err) {
                                            // console.error("Database error during branch retrieval:", err);
                                            reject(
                                                new Error('Failed to retrieve Branch. Please try again.')
                                            );
                                        }

                                        if (!currentBranch) {
                                            reject(
                                                new Error('Branch not found.')
                                            );
                                        }

                                        Admin.list((err, adminList) => {
                                            if (err) {
                                                // console.error("Database error:", err);
                                                reject(
                                                    new Error(err.message)
                                                );
                                            }
                                            Customer.getCustomerById(
                                                parseInt(currentBranch.customer_id),
                                                (err, currentCustomer) => {
                                                    if (err) {
                                                        /*
                                                        // console.error(
                                                            "Database error during customer retrieval:",
                                                            err
                                                        );
                                                        */
                                                        reject(
                                                            new Error('Failed to retrieve Customer. Please try again.')
                                                        );
                                                    }

                                                    if (!currentCustomer) {
                                                        reject(
                                                            new Error('Customer not found.')
                                                        );
                                                    }

                                                    CEF.formJsonWithData(
                                                        service_ids,
                                                        candidate_applicaton_id,
                                                        async (err, serviceData) => {
                                                            if (err) {
                                                                // console.error("Database error:", err);
                                                                reject(
                                                                    new Error('An error occurred while fetching service form json.')
                                                                );
                                                            }
                                                            data = {
                                                                application,
                                                                CEFData: CEFApplicationData,
                                                                branchInfo: currentBranch,
                                                                customerInfo: currentCustomer,
                                                                serviceData,
                                                                admins: adminList,
                                                            };

                                                            // console.log(`Step 2: Service data fetched for ID: ${candidate_applicaton_id}`);

                                                            const customerInfo = data.customerInfo || {};

                                                            customBgv = data.customerInfo?.is_custom_bgv || '';
                                                            companyName = data.application?.customer_name || '';
                                                            purpose = data.application?.purpose_of_application || '';
                                                            cefData = data.CEFData || {};
                                                            nationality = data.application?.nationality || '';
                                                            isSameAsPermanent = false

                                                            // console.log(`Step 3: Data prepared for PDF generation`);

                                                            const parsedData = data?.serviceData || [];

                                                            let allJsonData = [];
                                                            let allJsonDataValue = [];
                                                            let annexureData = [];
                                                            let initialAnnexureData = {
                                                                gap_validation: {
                                                                    highest_education_gap: '',
                                                                    years_of_experience_gap: '',
                                                                    no_of_employment: 0,

                                                                }
                                                            };
                                                            annexureData = initialAnnexureData;

                                                            // Populate annexureData from parsedData
                                                            if (parsedData && Object.keys(parsedData).length > 0) {
                                                                // Sorting and restructuring the parsed data
                                                                const sortedData = Object.entries(parsedData)
                                                                    .sort(([, a], [, b]) => {
                                                                        const groupA = a.group || '';  // Default to empty string if a.group is null or undefined
                                                                        const groupB = b.group || '';  // Default to empty string if b.group is null or undefined
                                                                        return groupA.localeCompare(groupB);
                                                                    })
                                                                    .reduce((acc, [key, value]) => {
                                                                        acc[key] = value;  // Reconstruct the object with sorted entries
                                                                        return acc;
                                                                    }, {});

                                                                // Collecting jsonData and jsonDataValue
                                                                for (const key in parsedData) {
                                                                    if (parsedData.hasOwnProperty(key)) {
                                                                        const jsonData = parsedData[key]?.jsonData;  // Safe navigation in case it's null or undefined
                                                                        if (jsonData) {
                                                                            allJsonData.push(jsonData);  // Store jsonData in the array
                                                                            ;
                                                                        }

                                                                        const jsonDataValue = parsedData[key]?.data;  // Safe navigation in case it's null or undefined
                                                                        if (jsonDataValue) {
                                                                            allJsonDataValue.push(jsonDataValue);  // Store jsonData in the array
                                                                        }
                                                                    }
                                                                }
                                                                // Constructing the annexureData object
                                                                allJsonData.forEach(service => {
                                                                    if (service.db_table !== 'gap_validation') {
                                                                        service?.rows?.forEach(row => {  // Check if rows exist before iterating
                                                                            row?.inputs?.forEach(input => {
                                                                                // Fetch the static inputs dynamically from annexureData

                                                                                // Fetch the dynamic field value from allJsonDataValue
                                                                                let fieldValue = allJsonDataValue.find(data => data && data.hasOwnProperty(input.name)); // Check for null or undefined before accessing `hasOwnProperty`
                                                                                // If fieldValue exists, we set it, otherwise, static value should remain
                                                                                if (fieldValue && fieldValue.hasOwnProperty(input.name)) {

                                                                                    // Set dynamic value in the correct field in annexureData
                                                                                    if (!annexureData[service.db_table]) {
                                                                                        annexureData[service.db_table] = {}; // Initialize the service table if it doesn't exist
                                                                                    }

                                                                                    // Set the dynamic value in the service table under the input's name
                                                                                    annexureData[service.db_table][input.name] = fieldValue[input.name] || "  ";


                                                                                } else {

                                                                                }
                                                                            });
                                                                        });
                                                                    } else {
                                                                        let fieldValue = allJsonDataValue.find(data => data && data.hasOwnProperty('no_of_employment')); // Check for null or undefined before accessing `hasOwnProperty`
                                                                        let initialAnnexureDataNew = initialAnnexureData;
                                                                        if (fieldValue && fieldValue.hasOwnProperty('no_of_employment')) {
                                                                            initialAnnexureDataNew = updateEmploymentFields(annexureData, fieldValue.no_of_employment, fieldValue); // Call function to handle employment fields
                                                                        } else {
                                                                        }
                                                                        annexureData[service.db_table].employment_fields = initialAnnexureDataNew.gap_validation.employment_fields;
                                                                    }

                                                                });
                                                            }

                                                            // console.log(`Step 4: Annexure data prepared for PDF generation`);

                                                            const serviceDataMain = allJsonData;
                                                            try {
                                                                const doc = new jsPDF();
                                                                let yPosition = 10;  // Initial y position

                                                                // Add the form title

                                                                if (customBgv === 1) {
                                                                    const imageData = await fetchImageToBase(LogoBgv);

                                                                    if (imageData) {
                                                                        doc.addImage(
                                                                            imageData,
                                                                            'png',
                                                                            75,
                                                                            yPosition,
                                                                            60,
                                                                            10
                                                                        );
                                                                    }
                                                                }

                                                                doc.autoTable({
                                                                    startY: yPosition,
                                                                    head: [
                                                                        [
                                                                            {
                                                                                content: 'Background Verification Form',
                                                                                styles: {
                                                                                    halign: 'left',
                                                                                    fontSize: 12,
                                                                                    fontStyle: 'bold',
                                                                                    fillColor: [197, 217, 241],textColor: [80, 80, 80]
                                                                                }
                                                                            }
                                                                        ],
                                                                    ],
                                                                    body: [
                                                                        
                                                                        [
                                                                            { content: `Company name: ${companyName}`, styles: { fontStyle: 'bold', } },
                                                                        ], 
                                                                        [
                                                                            { content: `Purpose of Application: ${purpose || 'NIL'}`, styles: { fontStyle: 'bold', } },
                                                                        ],
                                                                    ],
                                                                    theme: 'grid',
                                                                    margin: { top: 10 },
                                                                    styles: {
                                                                        cellPadding:2,
                                                                        fontSize: 10,
                                                                    }
                                                                });
                                                                yPosition += 40; 

                                                                const imageWidth = doc.internal.pageSize.width - 10; // 20px padding for margins
                                                                const imageHeight = 80; // Fixed height of 500px for the image
                                                                doc.setFontSize(16);
                                                                doc.setFont("helvetica", "bold");
                                                                if (purpose === 'NORMAL BGV(EMPLOYMENT)') {
                                                                    // Add a form group with Applicant's CV label
                                                                    doc.setFontSize(12);
                                                                    doc.text("Applicant’s CV", doc.internal.pageSize.width / 2, yPosition, {
                                                                        align: 'center'
                                                                    });

                                                                    if (cefData && cefData.resume_file) {
                                                                        // Check if the file is an image (this can be enhanced with MIME type checks, e.g., 'image/png', 'image/jpeg')
                                                                        const resumeFile = cefData.resume_file.trim();

                                                                        if (isImage(resumeFile)) {
                                                                            // If the resume file is an image, fetch and add it to the document
                                                                            const imageBases = await fetchImageToBase([resumeFile]);

                                                                            if (imageBases?.[0]?.base64) {
                                                                                doc.addImage(imageBases?.[0]?.base64, 'PNG', 5, yPosition + 10, imageWidth, imageHeight);
                                                                            } else {
                                                                                doc.text("Unable to load image.", 10, 40);
                                                                            }
                                                                        } else {
                                                                            const doctext = 'View Document';
                                                                            const doctextWidth = doc.getTextWidth(doctext);
                                                                            const noCVTextX = (doc.internal.pageSize.width - doctextWidth) / 2;
                                                                            const resumeUrl = resumeFile;
                                                                            doc.setTextColor(255, 0, 0); // Set the text color to blue (like a link)
                                                                            doc.textWithLink(doctext, noCVTextX, 60, { url: resumeUrl });  // Opens the document in a new tab
                                                                        }
                                                                    } else {
                                                                        // If no resume file is available, center the text for "No CV uploaded."
                                                                        const noCVText = "No CV uploaded.";
                                                                        const noCVTextWidth = doc.getTextWidth(noCVText);
                                                                        const noCVTextX = (doc.internal.pageSize.width - noCVTextWidth) / 2;

                                                                        doc.text(noCVText, noCVTextX + 40, 40);
                                                                    }


                                                                    // Helper function to determine if the file is an image (you can improve this with more MIME type checks)
                                                                    function isImage(fileName) {
                                                                        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
                                                                        return imageExtensions.some(extension => fileName.toLowerCase().endsWith(extension));
                                                                    }

                                                                }
                                                                // console.log(`Step 5: Adding images to PDF`);
                                                                doc.setTextColor(0, 0, 0);
                                                                if (purpose === 'NORMAL BGV(EMPLOYMENT)') {
                                                                    yPosition += imageHeight + 10;
                                                                }
                                                                yPosition += 10;
                                                                if (cefData && cefData.govt_id) {
                                                                    // Split the comma-separated string into an array of image URLs
                                                                    const govtIdUrls = cefData.govt_id.split(',').map(url => url.trim());

                                                                    // Check if there are any URLs in the array
                                                                    if (govtIdUrls.length > 0) {
                                                                        for (let i = 0; i < govtIdUrls.length; i++) {
                                                                            const govtIdUrl = govtIdUrls[i];

                                                                            // Fetch the image as base64
                                                                            // console.log(`govtIdUrl - `, govtIdUrl);
                                                                            const imageBases = await fetchImageToBase([govtIdUrl]);
                                                                            // console.log(`imageBases - `, imageBases);
                                                                            // Check if the image is valid
                                                                            if (imageBases?.[0]?.base64) {
                                                                                // Set font size and add the label for each image
                                                                                doc.setFontSize(12);
                                                                                const labelText = "Govt ID #" + (i + 1);
                                                                                const labelTextWidth = doc.getTextWidth(labelText);
                                                                                const labelCenterX = (doc.internal.pageSize.width - labelTextWidth) / 2;

                                                                                // Add label at the center for each image
                                                                                doc.text(labelText, labelCenterX, yPosition);

                                                                                // Add image to the document (ensure image fits properly)
                                                                                const imageWidth = doc.internal.pageSize.width - 10; // 20px padding for margins
                                                                                let imageHeight = 100; // Adjust according to your requirements
                                                                                if (yPosition > doc.internal.pageSize.height - 40) {
                                                                                    doc.addPage(); // Add a new page
                                                                                    imageHeight = 150;
                                                                                    yPosition = 20; // Reset yPosition for new page
                                                                                }
                                                                                doc.addImage(imageBases[0].base64, 'PNG', 5, yPosition + 5, imageWidth, imageHeight);

                                                                                // Update yPosition after adding the image
                                                                                yPosition += imageHeight + 10; // Adjust for image height + some margin

                                                                                // Check if the yPosition exceeds the page height, and if so, add a new page

                                                                            } else {
                                                                                // If no image is found for this govt_id, center the message
                                                                                const messageText = "Image #" + (i + 1) + " not found.";
                                                                                const messageTextWidth = doc.getTextWidth(messageText);
                                                                                const messageCenterX = (doc.internal.pageSize.width - messageTextWidth) / 2;

                                                                                doc.text(messageText, messageCenterX, yPosition);

                                                                                // Update yPosition after showing the message
                                                                                yPosition += 20 + 30; // Adjust for message height + margin

                                                                                // Check if the yPosition exceeds the page height, and if so, add a new page
                                                                                if (yPosition > doc.internal.pageSize.height - 40) {
                                                                                    doc.addPage();
                                                                                    imageHeight = 150;// Add a new page
                                                                                    yPosition = 20; // Reset yPosition for new page
                                                                                }
                                                                            }
                                                                        }
                                                                    } else {
                                                                        // If no government ID images are available in the string, center the message
                                                                        const noImagesText = "No Government ID images uploaded.";
                                                                        const noImagesTextWidth = doc.getTextWidth(noImagesText);
                                                                        const noImagesCenterX = (doc.internal.pageSize.width - noImagesTextWidth) / 2;

                                                                        doc.text(noImagesText, noImagesCenterX, 40);
                                                                    }
                                                                } else {
                                                                    // If govt_id is not present in cefData, center the message
                                                                    const noGovtIdText = "No Government ID uploaded.";
                                                                    const noGovtIdTextWidth = doc.getTextWidth(noGovtIdText);
                                                                    const noGovtIdCenterX = (doc.internal.pageSize.width - noGovtIdTextWidth) / 2;

                                                                    doc.text(noGovtIdText, noGovtIdCenterX, 40);
                                                                }

                                                                // console.log(`Step 6: Adding passport photo to PDF`);

                                                                if (customBgv === 1) {
                                                                    doc.addPage();
                                                                }
                                                                const passport_photoHeight = 62;
                                                                yPosition = 10;

                                                                if (customBgv === 1) {
                                                                    // Center the "Passport Photo" header
                                                                    const headerText = "Passport Photo.";
                                                                    doc.text(headerText, doc.internal.pageSize.width / 2, yPosition, { align: 'center' });

                                                                    if (cefData && cefData.passport_photo) {
                                                                        // Split the comma-separated image URLs into an array
                                                                        const imageUrls = cefData.passport_photo.trim().split(',').map(url => url.trim());

                                                                        // Filter valid image URLs based on file extensions
                                                                        const validImageUrls = imageUrls.filter(url => {
                                                                            const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
                                                                            return validImageExtensions.some(ext => url.toLowerCase().endsWith(ext));
                                                                        });

                                                                        if (validImageUrls.length > 0) {
                                                                            // Constants for grid layout
                                                                            const cols = validImageUrls.length > 3 ? 3 : validImageUrls.length;  // Limit to 3 columns at most
                                                                            const margin = 5;  // Space between images
                                                                            const xStart = 5;  // Starting x position
                                                                            const yStart = yPosition + 10;  // Starting y position (below the header)
                                                                            const pageWidth = doc.internal.pageSize.width; // Get the page width

                                                                            let xPos = xStart;
                                                                            yPosition = yStart;

                                                                            // Dynamically calculate the image width based on the number of images
                                                                            const imageWidth = validImageUrls.length === 1 ? pageWidth - 2 * margin :
                                                                                validImageUrls.length === 2 ? (pageWidth / 2) - margin :
                                                                                    validImageUrls.length === 3 ? (pageWidth / 3) - margin :
                                                                                        (pageWidth / 3) - margin; // Use 3 columns for more than 3 images

                                                                            // Loop through each valid image URL and process it
                                                                            for (let i = 0; i < validImageUrls.length; i++) {
                                                                                const imageUrl = validImageUrls[i];
                                                                                try {
                                                                                    // Fetch the base64 image for each URL
                                                                                    const imageBases = await fetchImageToBase([imageUrl]);

                                                                                    if (imageBases && imageBases[0]?.base64) {
                                                                                        // Add image to the PDF at the correct xPos and yPosition (grid layout)
                                                                                        doc.addImage(imageBases[0].base64, imageBases[0].type, xPos, yPosition, imageWidth, passport_photoHeight);

                                                                                        // Update xPos for the next image (move horizontally)
                                                                                        xPos += imageWidth + margin;

                                                                                        // If we have reached the end of the row (3 columns), reset xPos and move to the next row
                                                                                        if ((i + 1) % cols === 0) {
                                                                                            xPos = xStart;
                                                                                            yPosition += passport_photoHeight + margin;  // Move to the next row
                                                                                        }
                                                                                    } else {
                                                                                        // console.error(`Image at index ${i} could not be loaded.`);
                                                                                        const imageNotFoundText = `Image #${i + 1} not found.`;
                                                                                        const imageNotFoundTextWidth = doc.getTextWidth(imageNotFoundText);
                                                                                        const imageNotFoundCenterX = (doc.internal.pageSize.width - imageNotFoundTextWidth) / 2;
                                                                                        doc.text(imageNotFoundText, imageNotFoundCenterX, yPosition + 10);
                                                                                        yPosition += 10;  // Update yPos for the error message
                                                                                    }
                                                                                } catch (error) {
                                                                                    // console.error(`Error loading image at index ${i}:`, error);
                                                                                    const errorMessage = `Error loading image #${i + 1}.`;
                                                                                    const errorTextWidth = doc.getTextWidth(errorMessage);
                                                                                    const errorTextCenterX = (doc.internal.pageSize.width - errorTextWidth) / 2;
                                                                                    doc.text(errorMessage, errorTextCenterX, yPosition + 10);
                                                                                    yPosition += 20;  // Update yPos for the error message
                                                                                }
                                                                            }
                                                                        } else {
                                                                            // If no valid image URLs are found, display a message
                                                                            const noImagesText = "No valid Passport Photo images found.";
                                                                            const noImagesTextWidth = doc.getTextWidth(noImagesText);
                                                                            const noImagesCenterX = (doc.internal.pageSize.width - noImagesTextWidth) / 2;
                                                                            doc.text(noImagesText, noImagesCenterX, yPosition + 10);
                                                                            yPosition += 20; // Adjust for the message
                                                                        }

                                                                    } else {
                                                                        // If no passport photo is available, display a message
                                                                        const noPhotoText = "No Passport Photo uploaded.";
                                                                        const noPhotoTextWidth = doc.getTextWidth(noPhotoText);
                                                                        const noPhotoCenterX = (doc.internal.pageSize.width - noPhotoTextWidth) / 2;
                                                                        doc.text(noPhotoText, noPhotoCenterX, yPosition + 10);
                                                                        yPosition += 20; // Adjust position for the message
                                                                    }
                                                                }

                                                                // console.log(`Step 7: Adding personal information to PDF`);




                                                                const body = [
                                                                    // Row 1: Headers
                                                                    [
                                                                        {
                                                                            content: "Name of the Candidate (As per Government\nIdentity proof)",
                                                                            colSpan: 1,
                                                                            styles: { fontStyle: 'bold' }
                                                                          }, 
                                                                      { content: cefData.full_name || "N/A" },
                                                                      { content: "Pancard Number", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.pan_card_number || "N/A" },
                                                                    ],
                                                                    // Row 2: Data for row 1
                                                                    [
                                                                      { content: "Aadhar Number", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.aadhar_card_number || "N/A" },
                                                                      { content: "Father's Name", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.father_name || "N/A" },
                                                                    ],
                                                                    // Row 3: Second header row
                                                                    [
                                                                      { content: "Date of Birth(dd/mm/yy)", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.dob || "N/A" },
                                                                      { content: "Husband's Name", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.husband_name || "N/A" },
                                                                    ],
                                                                    // Row 5: Third header row
                                                                    [
                                                                      { content: "Gender", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.gender || "N/A" },
                                                                      { content: "Mobile Number", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.mb_no || "N/A" },
                                                                    ],
                                                                    // Row 6: Data for row 5
                                                                    [
                                                                      { content: "Nationality", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.nationality || "N/A" },
                                                                      { content: "Marital Status", styles: { fontStyle: 'bold' } },
                                                                      { content: cefData.marital_status || "N/A" },
                                                                    ]
                                                                  ];
                                                                  

                                                                // Header row
                                                                const head = [
                                                                    [
                                                                        {
                                                                            content: "Personal Information",
                                                                            colSpan: 4,
                                                                            styles: { halign: "left", fontSize: 12, fontStyle: "bold", fillColor: [197, 217, 241] ,textColor: [80, 80, 80] }
                                                                        }
                                                                    ]
                                                                ];

                                                                // Generate PDF page
                                                                doc.addPage();
                                                                yPosition = 20;

                                                                doc.autoTable({
                                                                    startY: yPosition + 5,
                                                                    head: head,
                                                                    body: body,
                                                                    theme: 'grid',
                                                                    margin: { top: 10 },
                                                                    styles: {
                                                                        cellPadding: 2,
                                                                        fontSize: 10,
                                                                        halign: 'left',
                                                                        valign: 'middle',
                                                                        font: 'helvetica',
                                                                        lineWidth: 0.2
                                                                    },
                                                                });


                                                                // console.log(`Step 8: Adding Aadhar and Pan card images to PDF`);

                                                                const aadharcardimageHeight = 100;
                                                                yPosition = doc.autoTable.previous.finalY + 10;

                                                                if (customBgv === 1 && nationality === "Indian") {
                                                                    // Add Aadhaar card image if available
                                                                    if (cefData.aadhar_card_image) {
                                                                        doc.addPage();
                                                                        let yPosition = 10; // Reset yPosition for a new page
                                                                        doc.setTextColor(0, 0, 0);
                                                                        // Center the "Aadhar Card Image" header
                                                                        doc.text('Aadhar Card Image', doc.internal.pageSize.width / 2, yPosition + 10, {
                                                                            align: 'center'
                                                                        });

                                                                        // Process Aadhaar card image
                                                                        const imageUrls = [cefData.aadhar_card_image.trim()];
                                                                        const imageUrlsToProcess = imageUrls.filter(url => {
                                                                            const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
                                                                            return validImageExtensions.some(ext => url.toLowerCase().endsWith(ext));
                                                                        });

                                                                        // If it's an image, add to PDF
                                                                        if (imageUrlsToProcess.length > 0) {
                                                                            const imageBases = await fetchImageToBase(imageUrlsToProcess);
                                                                            doc.addImage(imageBases[0]?.base64, imageBases[0]?.type, 5, yPosition + 20, imageWidth, aadharcardimageHeight);
                                                                            yPosition += aadharcardimageHeight;
                                                                        } else {
                                                                            // If not an image (e.g., PDF or XLS), show a clickable link centered
                                                                            const fileUrl = cefData.aadhar_card_image.trim();
                                                                            const buttonText = `Click to open Aadhar Card File`;
                                                                            const textWidth = doc.getTextWidth(buttonText);
                                                                            const centerX = (doc.internal.pageSize.width - textWidth) / 2;

                                                                            doc.setFont("helvetica", "normal");
                                                                            doc.setFontSize(10);
                                                                                doc.setTextColor(255, 0, 0);
                                                                            doc.text(buttonText, centerX, yPosition + 20);

                                                                            // Create clickable link to open the file
                                                                            doc.link(centerX, yPosition + 10, textWidth, 10, { url: fileUrl });

                                                                            yPosition += 20;
                                                                        }
                                                                    }

                                                                    yPosition = aadharcardimageHeight + 40;
                                                                    if (cefData.pan_card_image) {
                                                                        // Center the "Pan Card Image" header
                                                                        doc.setTextColor(0, 0, 0);
                                                                        doc.text('Pan Card Image', doc.internal.pageSize.width / 2, yPosition + 10, {
                                                                            align: 'center'
                                                                        });

                                                                        const imageUrls = [cefData.pan_card_image.trim()];
                                                                        const imageUrlsToProcess = imageUrls.filter(url => {
                                                                            const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
                                                                            return validImageExtensions.some(ext => url.toLowerCase().endsWith(ext));
                                                                        });

                                                                        // If it's an image, add to PDF
                                                                        if (imageUrlsToProcess.length > 0) {
                                                                            const imageBases = await fetchImageToBase(imageUrlsToProcess);
                                                                            doc.addImage(imageBases[0]?.base64, imageBases[0]?.type, 5, yPosition + 20, imageWidth, aadharcardimageHeight);
                                                                            yPosition += aadharcardimageHeight + 20;
                                                                        } else {
                                                                            // If not an image (e.g., PDF or XLS), show a clickable link centered
                                                                            const fileUrl = cefData.pan_card_image.trim();
                                                                            const buttonText = `Click to open Pan Card File`;
                                                                            const textWidth = doc.getTextWidth(buttonText);
                                                                            const centerX = (doc.internal.pageSize.width - textWidth) / 2;

                                                                            doc.setFont("helvetica", "normal");
                                                                            doc.setFontSize(10);
                                                                            doc.setTextColor(255, 0, 0);
                                                                            doc.text(buttonText, centerX, yPosition + 20);

                                                                            // Create clickable link to open the file
                                                                            doc.link(centerX, yPosition + 10, textWidth, 10, { url: fileUrl });

                                                                            yPosition += 20;
                                                                        }
                                                                    }
                                                                } else {
                                                                    yPosition = doc.autoTable.previous.finalY + 10;
                                                                }

                                                                if (customBgv === 1 && nationality === "Indian") {
                                                                    doc.addPage();
                                                                    yPosition = 10;
                                                                }

                                                                // console.log(`Step 9: Adding address information to PDF`);

                                                                doc.setFontSize(14);
                                                                yPosition += 10; // Move yPosition down for the next section

                                                                // Table for Permanent Address
                                                                doc.autoTable({
                                                                    startY: yPosition,
                                                                    head: [
                                                                        [
                                                                            {
                                                                                content: 'Permanent Address',
                                                                                colSpan: 4,
                                                                                styles: {
                                                                                    halign: 'left',
                                                                                    fontSize: 12,
                                                                                    fontStyle: 'bold',
                                                                                    fillColor: [197, 217, 241],textColor: [80, 80, 80]
                                                                                }
                                                                            }
                                                                        ],
                                                                    ],
                                                                    body: [
                                                                        [
                                                                            { content: 'Permanent Address', styles: { fontStyle: 'bold', } },
                                                                            cefData.permanent_address || 'N/A',
                                                                            { content: 'Pin Code', styles: { fontStyle: 'bold', } },
                                                                            cefData.permanent_pin_code || 'N/A',
                                                                            
                                                                        ],
                                                                        [
                                                                            { content: 'Mobile Number', styles: { fontStyle: 'bold', } },
                                                                            cefData.permanent_address_landline_number || 'N/A',
                                                                            { content: 'Current State', styles: { fontStyle: 'bold', } },
                                                                            cefData.permanent_address_state || 'N/A'
                                                                        ],
                                                                        [
                                                                            { content: 'Current Landmark', styles: { fontStyle: 'bold', } },
                                                                            cefData.permanent_prominent_landmark || 'N/A',
                                                                            { content: 'Current Address Stay No.', styles: { fontStyle: 'bold', } },
                                                                            cefData.permanent_address_stay_to || 'N/A',

                                                                        ],
                                                                        [
                                                                            { content: 'Nearest Police Station', styles: { fontStyle: 'bold', } },  
                                                                            cefData.permanent_address_nearest_police_station || 'N/A'
                                                                        ]
                                                                    ],
                                                                    theme: 'grid',
                                                                    margin: { top: 10 },
                                                                    styles: {
                                                                        fontSize: 10,
                                                                        cellPadding: 2
                                                                    }
                                                                });


                                                                // Update yPosition after the permanent address table
                                                                yPosition = doc.autoTable.previous.finalY + 20; // Add a small margin after the table

                                                                // Check if current address is different from permanent address
                                                                if (!isSameAsPermanent) {
                                                                    // Table for Current Address if not same as Permanent Address
                                                                    doc.autoTable({
                                                                        startY: yPosition,
                                                                        head: [
                                                                            [
                                                                                {
                                                                                    content: 'Current Address',
                                                                                    colSpan: 4,
                                                                                    styles: {
                                                                                        halign: 'left',
                                                                                        fontSize: 12,
                                                                                        fontStyle: 'bold',
                                                                                        fillColor: [197, 217, 241],textColor: [80, 80, 80]
                                                                                    }
                                                                                }
                                                                            ]
                                                                        ],
                                                                        body: [
                                                                            [
                                                                                { content: 'Current Address', styles: { fontStyle: 'bold' } },
                                                                                cefData.current_address || 'N/A',
                                                                                { content: 'Pin Code', styles: { fontStyle: 'bold' } },
                                                                                cefData.current_address_pin_code || 'N/A',
                                                                              
                                                                            ],
                                                                            [
                                                                                { content: 'Mobile Number', styles: { fontStyle: 'bold' } },
                                                                                cefData.current_address_landline_number || 'N/A',
                                                                                { content: 'Current State', styles: { fontStyle: 'bold' } },
                                                                                cefData.current_address_state || 'N/A'
                                                                            ],
                                                                            [
                                                                                { content: 'Current Landmark', styles: { fontStyle: 'bold' } },
                                                                                cefData.current_prominent_landmark || 'N/A',
                                                                                { content: 'Current Address Stay No.', styles: { fontStyle: 'bold' } },
                                                                                cefData.current_address_stay_to || 'N/A',
                                                                                ''
                                                                            ],
                                                                            [
                                                                                { content: 'Nearest Police Station', styles: { fontStyle: 'bold' } },
                                                                                cefData.current_address_nearest_police_station || 'N/A',
                                                                                ''
                                                                            ]
                                                                        ],
                                                                        theme: 'grid',
                                                                        margin: { top: 10 },
                                                                        styles: {
                                                                            fontSize: 10,
                                                                            cellPadding: 2
                                                                        }
                                                                    });


                                                                    // Update yPosition after the current address table
                                                                    yPosition = doc.autoTable.previous.finalY + 10; // Add a small margin after the table
                                                                }


                                                                yPosition = doc.autoTable.previous.finalY + 10;
                                                                // console.log(`Step 10: Adding education information to PDF`);
                                                                (async () => {
                                                                    if (!serviceDataMain.length) {
                                                                        const pageWidth = doc.internal.pageSize.width;
                                                                        doc.text("No service data available.", pageWidth / 2, yPosition + 10, { align: 'center' });
                                                                        yPosition += 20;
                                                                    } else {

                                                                        // const selectedServices = serviceDataMain.slice(0, 2); // Get only the first 2 services

                                                                        for (let i = 0; i < serviceDataMain.length; i++) {
                                                                            const service = serviceDataMain[i];
                                                                            const tableData = [];

                                                                            if (serviceDataMain.length > 1) {
                                                                                doc.addPage();
                                                                                yPosition = 20;
                                                                            }
                                                                            // Reset yPosition before each service

                                                                            function renderGapMessageNew(gap) {
                                                                                if (!gap) {
                                                                                    return 'No Gap'; // Return 'N/A' if gap is undefined or null
                                                                                }
                                                                                const { years, months } = gap; // Safely destructure if gap is valid
                                                                                return `${years} years and ${months} months`;
                                                                            }


                                                                            if (service.db_table === "gap_validation") {


                                                                                doc.setFontSize(12);
                                                                                doc.setTextColor(0, 0, 0);
                                                                                if (annexureData?.gap_validation?.highest_education_gap === 'phd') {
                                                                                    const { employGaps, gaps } = calculateGaps(annexureData);
                                                                                    // console.log(`gaps - `, gaps);
                                                                                    // Table for PhD information
                                                                                    yPosition += 10;
                                                                                    doc.autoTable({
                                                                                        startY: yPosition,
                                                                                        head: [
                                                                                            [
                                                                                                {
                                                                                                    content: 'PHD',
                                                                                                    colSpan: 2,
                                                                                                    styles: {
                                                                                                        halign: 'left',
                                                                                                        fontSize: 12,
                                                                                                        fontStyle: 'bold',
                                                                                                        fillColor: [197, 217, 241],textColor: [80, 80, 80]
                                                                                                    }
                                                                                                }
                                                                                            ]
                                                                                        ],
                                                                                        body: [
                                                                                            [
                                                                                                { content: 'Institute Name', styles: { fontStyle: 'bold' } },
                                                                                                annexureData?.gap_validation?.education_fields?.phd_1?.phd_institute_name_gap || 'N/A'
                                                                                            ],
                                                                                            [
                                                                                                { content: 'School Name', styles: { fontStyle: 'bold' } },
                                                                                                annexureData?.gap_validation?.education_fields?.phd_1?.phd_school_name_gap || 'N/A'
                                                                                            ],
                                                                                            [
                                                                                                { content: 'Start Date', styles: { fontStyle: 'bold' } },
                                                                                                annexureData?.gap_validation?.education_fields?.phd_1?.phd_start_date_gap || 'N/A'
                                                                                            ],
                                                                                            [
                                                                                                { content: 'End Date', styles: { fontStyle: 'bold' } },
                                                                                                annexureData?.gap_validation?.education_fields?.phd_1?.phd_end_date_gap || 'N/A'
                                                                                            ],
                                                                                            [
                                                                                                { content: 'Specialization', styles: { fontStyle: 'bold' } },
                                                                                                annexureData?.gap_validation?.education_fields?.phd_1?.phd_specialization_gap || 'N/A'
                                                                                            ],
                                                                                            [
                                                                                                { content: 'Gap Status', styles: { fontStyle: 'bold' } },
                                                                                                renderGapMessageNew(gaps?.gapPostGradToPhd) || 'N/A'
                                                                                            ]
                                                                                        ],
                                                                                        theme: 'grid',
                                                                                        margin: { top: 10 },
                                                                                        styles: {
                                                                                            fontSize: 10,
                                                                                            cellPadding: 2
                                                                                        }
                                                                                    });


                                                                                    let index = 1;
                                                                                    let phdSections = [];

                                                                                    while (true) {
                                                                                        const key = `phd_corespondence_${index}`;

                                                                                        // Check if the key exists in annexureData
                                                                                        if (!annexureData?.gap_validation?.education_fields?.[key]) {
                                                                                            break; // Exit loop if the key is missing
                                                                                        }

                                                                                        const phdSection = annexureData.gap_validation.education_fields[key];

                                                                                        // Log the current phdSection to ensure data is being read correctly

                                                                                        phdSections.push([
                                                                                            `Correspondence Phd ${index}`,
                                                                                            phdSection?.phd_institute_name_gap || 'N/A',
                                                                                            phdSection?.phd_school_name_gap || 'N/A',
                                                                                            phdSection?.phd_start_date_gap || 'N/A',
                                                                                            phdSection?.phd_end_date_gap || 'N/A',
                                                                                            phdSection?.phd_specialization_gap || 'N/A'
                                                                                        ]);

                                                                                        index++; // Move to the next phd_corespondence_*
                                                                                    }

                                                                                    // Check if phdSections is populated before attempting to render

                                                                                    if (phdSections.length > 0) {
                                                                                        doc.setFontSize(16);
                                                                                        const textWidth = doc.internal.pageSize.width;
                                                                                        doc.text("Correspondence Phd Details", doc.internal.pageSize.width / 2, doc.autoTable.previous.finalY + 10, {
                                                                                            align: 'center'
                                                                                        });
                                                                                        // Add the table data
                                                                                        doc.autoTable({
                                                                                            head: [['Correspondence', 'Institute Name', 'School Name', 'Start Date', 'End Date', 'Specialization']],
                                                                                            body: phdSections,
                                                                                            startY: doc.autoTable.previous.finalY + 20, // Start below the title
                                                                                            theme: 'grid',
                                                                                            styles: {
                                                                                                cellPadding: 2,
                                                                                                fontSize: 10
                                                                                            }
                                                                                        });
                                                                                    } else {
                                                                                    }

                                                                                }
                                                                                yPosition = doc.autoTable.previous.finalY + 10;
                                                                                // Post Graduation
                                                                                if (annexureData?.gap_validation?.highest_education_gap === 'post_graduation' || annexureData?.gap_validation?.highest_education_gap === 'phd') {
                                                                                    doc.addPage();
                                                                                    yPosition = 20;
                                                                                    const { employGaps, gaps } = calculateGaps(annexureData);
                                                                                    const postGradData = [
                                                                                        ["University / Institute Name", annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_university_institute_name_gap || 'N/A'],
                                                                                        ["Course", annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_course_gap || 'N/A'],
                                                                                        ["Specialization Major", annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_specialization_major_gap || 'N/A'],
                                                                                        ["Start Date", annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_start_date_gap || 'N/A'],
                                                                                        ["End Date", annexureData?.gap_validation?.education_fields?.post_graduation_1?.post_graduation_end_date_gap || 'N/A'],
                                                                                        ["Gap Status", renderGapMessageNew(gaps?.gapGradToPostGrad) || 'N/A']
                                                                                    ];


                                                                                    doc.autoTable({
                                                                                        head: [[{ content: 'POST GRADUATION', colSpan: 2, styles: { halign: 'center', fontSize: 12, bold: true } }],
                                                                                        ],
                                                                                        body: postGradData,
                                                                                        startY: yPosition + 5,
                                                                                        theme: 'grid',
                                                                                        styles: {
                                                                                            cellPadding: 2,
                                                                                            fontSize: 10
                                                                                        }
                                                                                    });

                                                                                    let index = 1;
                                                                                    let postGradSections = [];
                                                                                    while (true) {
                                                                                        const key = `post_graduation_corespondence_${index}`;

                                                                                        // Check if the key exists in the annexureData
                                                                                        if (!annexureData?.gap_validation?.education_fields?.[key]) {
                                                                                            break; // Exit loop if the key is missing
                                                                                        }

                                                                                        const postGradSection = annexureData.gap_validation.education_fields[key];

                                                                                        // Push the section data into postGradSections array
                                                                                        postGradSections.push([
                                                                                            `Correspondence Post Graduation ${index}`,
                                                                                            postGradSection?.post_graduation_university_institute_name_gap || 'N/A',
                                                                                            postGradSection?.post_graduation_course_gap || 'N/A',
                                                                                            postGradSection?.post_graduation_specialization_major_gap || 'N/A',
                                                                                            postGradSection?.post_graduation_start_date_gap || 'N/A',
                                                                                            postGradSection?.post_graduation_end_date_gap || 'N/A'
                                                                                        ]);

                                                                                        index++; // Move to the next post_graduation_corespondence_*
                                                                                    }

                                                                                    // Add a title for the table
                                                                                    yPosition += 20;

                                                                                    if (postGradSections.length > 0) {
                                                                                        doc.setFontSize(16);
                                                                                        doc.text("Correspondence Post Graduation Details", doc.internal.pageSize.width / 2, doc.autoTable.previous.finalY + 10, {
                                                                                            align: 'center'
                                                                                        });

                                                                                        doc.autoTable({
                                                                                            head: [['Correspondence', 'University/Institute Name', 'Course', 'Specialization Major', 'Start Date', 'End Date']],
                                                                                            body: postGradSections,
                                                                                            startY: doc.autoTable.previous.finalY + 20, // Start below the title
                                                                                            theme: 'grid',
                                                                                            styles: {
                                                                                                cellPadding: 2,
                                                                                                fontSize: 10
                                                                                            }
                                                                                        });
                                                                                    }

                                                                                }

                                                                                // Graduation
                                                                                yPosition = yPosition += 30;
                                                                                if (annexureData?.gap_validation?.highest_education_gap === 'graduation' || annexureData?.gap_validation?.highest_education_gap === 'post_graduation' || annexureData?.gap_validation?.highest_education_gap === 'phd') {
                                                                                    const { employGaps, gaps } = calculateGaps(annexureData);

                                                                                    const gradData = [
                                                                                        ["University / Institute Name", annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_university_institute_name_gap || 'N/A'],
                                                                                        ["Course", annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_course_gap || 'N/A'],
                                                                                        ["Specialization Major", annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_specialization_major_gap || 'N/A'],
                                                                                        ["Start Date", annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_start_date_gap || 'N/A'],
                                                                                        ["End Date", annexureData?.gap_validation?.education_fields?.graduation_1?.graduation_end_date_gap || 'N/A'],
                                                                                        ["Gap Status", renderGapMessageNew(gaps?.gapSrSecToGrad) || 'N/A']

                                                                                    ];

                                                                                    doc.autoTable({
                                                                                        head: [[{ content: 'GRADUATION', colSpan: 2, styles: { halign: 'center', fontSize: 12, bold: true } }],
                                                                                        ],
                                                                                        body: gradData,
                                                                                        startY: doc.autoTable.previous.finalY + 10,
                                                                                        theme: 'grid',
                                                                                        styles: {
                                                                                            cellPadding: 2,
                                                                                            fontSize: 10
                                                                                        }
                                                                                    });

                                                                                    let index = 1;
                                                                                    let Graduation = [];
                                                                                    while (true) {
                                                                                        const key = `graduation_corespondence_${index}`;

                                                                                        // Check if the key exists in the annexureData
                                                                                        if (!annexureData?.gap_validation?.education_fields?.[key]) {
                                                                                            break; // Exit loop if the key is missing
                                                                                        }

                                                                                        const GradSec = annexureData.gap_validation.education_fields[key];

                                                                                        // Push the section data into Graduation array
                                                                                        Graduation.push([
                                                                                            `Correspondence Graduation ${index}`,
                                                                                            GradSec?.graduation_university_institute_name_gap || 'N/A',
                                                                                            GradSec?.graduation_course_gap || 'N/A',
                                                                                            GradSec?.graduation_specialization_major_gap || 'N/A',
                                                                                            GradSec?.graduation_start_date_gap || 'N/A',
                                                                                            GradSec?.graduation_end_date_gap || 'N/A'
                                                                                        ]);

                                                                                        index++; // Move to the next post_graduation_corespondence_*
                                                                                    }

                                                                                    if (Graduation.length > 0) {
                                                                                        // Add a title for the table
                                                                                        doc.setFontSize(16);
                                                                                        doc.text("Correspondence Graduation Details", doc.internal.pageSize.width / 2, doc.autoTable.previous.finalY + 10, {
                                                                                            align: 'center'
                                                                                        });
                                                                                        // Add the table data
                                                                                        doc.autoTable({
                                                                                            head: [['Correspondence', 'University/Institute Name', 'Course', 'Specialization Major', 'Start Date', 'End Date']],
                                                                                            body: Graduation,
                                                                                            startY: doc.autoTable.previous.finalY + 30, // Start below the title
                                                                                            theme: 'grid',
                                                                                            styles: {
                                                                                                cellPadding: 2,
                                                                                                fontSize: 10
                                                                                            }
                                                                                        });

                                                                                    }

                                                                                    // Call this function separately if required for gap message
                                                                                }

                                                                                if (annexureData?.gap_validation?.highest_education_gap === 'senior_secondary' || annexureData?.gap_validation?.highest_education_gap === 'graduation' || annexureData?.gap_validation?.highest_education_gap === 'phd' || annexureData?.gap_validation?.highest_education_gap === 'post_graduation') {
                                                                                    const { employGaps, gaps } = calculateGaps(annexureData);
                                                                                    const seniorSecondaryData = [
                                                                                        ["School Name", annexureData?.gap_validation?.education_fields?.senior_secondary?.senior_secondary_school_name_gap || 'N/A'],
                                                                                        ["Start Date", annexureData?.gap_validation?.education_fields?.senior_secondary?.senior_secondary_start_date_gap || 'N/A'],
                                                                                        ["End Date", annexureData?.gap_validation?.education_fields?.senior_secondary?.senior_secondary_end_date_gap || 'N/A'],
                                                                                        ["Gap Status", renderGapMessageNew(gaps?.gapSecToSrSec) || 'N/A']
                                                                                    ];

                                                                                    doc.autoTable({
                                                                                        head: [[{ content: 'SENIOR SECONDARY', colSpan: 2, styles: { halign: 'center', fontSize: 12, bold: true } }],
                                                                                        ],
                                                                                        body: seniorSecondaryData,
                                                                                        startY: doc.autoTable.previous.finalY + 30,
                                                                                        theme: 'grid',
                                                                                        styles: {
                                                                                            cellPadding: 2,
                                                                                            fontSize: 10
                                                                                        }
                                                                                    });

                                                                                    let index = 1;
                                                                                    let seniorSecondarySections = [];

                                                                                    while (true) {
                                                                                        const key = `senior_secondary_corespondence_${index}`;

                                                                                        // Check if the key exists in annexureData
                                                                                        if (!annexureData?.gap_validation?.education_fields?.[key]) {
                                                                                            break; // Exit loop if the key is missing
                                                                                        }

                                                                                        const seniorSecondarySection = annexureData.gap_validation.education_fields[key];

                                                                                        // Push the section data into seniorSecondarySections array
                                                                                        seniorSecondarySections.push([
                                                                                            `Correspondence SENIOR SECONDARY ${index}`,
                                                                                            seniorSecondarySection?.senior_secondary_school_name_gap || 'N/A',
                                                                                            seniorSecondarySection?.senior_secondary_start_date_gap || 'N/A',
                                                                                            seniorSecondarySection?.senior_secondary_end_date_gap || 'N/A'
                                                                                        ]);

                                                                                        index++; // Move to the next senior_secondary_corespondence_*
                                                                                    }

                                                                                    // Add a title for the table
                                                                                    if (seniorSecondarySections.length > 0) {
                                                                                        doc.setFontSize(16);
                                                                                        doc.text("Correspondence Senior Secondary Details", doc.internal.pageSize.width / 2, doc.autoTable.previous.finalY + 10, {
                                                                                            align: 'center'
                                                                                        });
                                                                                        // Add the table data
                                                                                        doc.autoTable({
                                                                                            head: [['Correspondence', 'School Name', 'Start Date', 'End Date']],
                                                                                            body: seniorSecondarySections,
                                                                                            startY: doc.autoTable.previous.finalY + 20, // Start below the title
                                                                                            theme: 'grid',
                                                                                            styles: {
                                                                                                cellPadding: 2,
                                                                                                fontSize: 10
                                                                                            }
                                                                                        });

                                                                                    }

                                                                                    ;  // Call this function separately if required for gap message
                                                                                }

                                                                                doc.addPage();
                                                                                yPosition = 10;
                                                                                // Secondary Education Section
                                                                                if (
                                                                                    annexureData["gap_validation"].highest_education_gap === 'secondary' ||
                                                                                    annexureData["gap_validation"].highest_education_gap === 'senior_secondary' ||
                                                                                    annexureData["gap_validation"].highest_education_gap === 'graduation' ||
                                                                                    annexureData["gap_validation"].highest_education_gap === 'phd' ||
                                                                                    annexureData["gap_validation"].highest_education_gap === 'post_graduation'
                                                                                ) {

                                                                                    const secondaryData = [
                                                                                        ["School Name", annexureData?.gap_validation?.education_fields?.secondary?.secondary_school_name_gap || 'N/A'],
                                                                                        ["Start Date", annexureData?.gap_validation?.education_fields?.secondary?.secondary_start_date_gap || 'N/A'],
                                                                                        ["End Date", annexureData?.gap_validation?.education_fields?.secondary?.secondary_end_date_gap || 'N/A']
                                                                                    ];

                                                                                    // Generate the table for secondary education
                                                                                    doc.autoTable({
                                                                                        head: [[{ content: 'SECONDARY', colSpan: 2, styles: { halign: 'center', fontSize: 12, bold: true } }],
                                                                                        ],
                                                                                        body: secondaryData,
                                                                                        startY: yPosition,
                                                                                        theme: 'grid',
                                                                                        styles: {
                                                                                            cellPadding: 2,
                                                                                            fontSize: 10
                                                                                        }
                                                                                    });

                                                                                    let index = 1;
                                                                                    let SecondarySections = [];

                                                                                    // Loop through to find any "secondary_corespondence_*" sections and add them
                                                                                    while (true) {
                                                                                        const key = `secondary_corespondence_${index}`;

                                                                                        // Check if the key exists in annexureData
                                                                                        if (!annexureData?.gap_validation?.education_fields?.[key]) {
                                                                                            break; // Exit loop if the key is missing
                                                                                        }

                                                                                        const secondarySection = annexureData.gap_validation.education_fields[key];

                                                                                        // Push the section data into SecondarySections array
                                                                                        SecondarySections.push([
                                                                                            `Correspondence SECONDARY ${index}`,
                                                                                            secondarySection?.secondary_school_name_gap || 'N/A',
                                                                                            secondarySection?.secondary_start_date_gap || 'N/A',
                                                                                            secondarySection?.secondary_end_date_gap || 'N/A'
                                                                                        ]);

                                                                                        index++; // Move to the next secondary_corespondence_*
                                                                                    }

                                                                                    // Add a title for the table if there are any secondary sections
                                                                                    if (SecondarySections.length > 0) {
                                                                                        doc.setFontSize(16);
                                                                                        doc.text("Correspondence Secondary Education Details", doc.internal.pageSize.width / 2, doc.autoTable.previous.finalY + 10, {
                                                                                            align: 'center'
                                                                                        });
                                                                                        // Add the table data
                                                                                        doc.autoTable({
                                                                                            head: [['Secondary No.', 'School Name', 'Start Date', 'End Date']],
                                                                                            body: SecondarySections,
                                                                                            startY: doc.autoTable.previous.finalY + 20, // Start below the title
                                                                                            theme: 'grid',
                                                                                            styles: {
                                                                                                cellPadding: 2,
                                                                                                fontSize: 10
                                                                                            }
                                                                                        });


                                                                                    }
                                                                                }


                                                                                yPosition = doc.autoTable.previous.finalY + 10;

                                                                                // Employment Section
                                                                                doc.setFontSize(18);
                                                                                const employmentData = [
                                                                                    ["Years of Experience", annexureData["gap_validation"].years_of_experience_gap || ''],
                                                                                    ["No of Employment", annexureData["gap_validation"].no_of_employment || '']
                                                                                ];

                                                                                doc.autoTable({
                                                                                    head: [[{ content: `Employment Deails`, colSpan: 2, styles: { halign: 'center', fontSize: 12, bold: true } }],
                                                                                    ],
                                                                                    body: employmentData,
                                                                                    startY: doc.autoTable.previous.finalY + 10,
                                                                                    theme: 'grid',
                                                                                    styles: {
                                                                                        cellPadding: 2,
                                                                                        fontSize: 10
                                                                                    }
                                                                                });

                                                                                doc.setFontSize(12);
                                                                                // Dynamically render Employment Forms
                                                                                if (annexureData["gap_validation"].no_of_employment > 0) {
                                                                                    let yPosition = doc.autoTable.previous.finalY + 10;
                                                                                    const { employGaps, gaps } = calculateGaps(annexureData);
                                                                                    Array.from({ length: annexureData["gap_validation"].no_of_employment || 0 }, (_, index) => {
                                                                                        const employmentFormData = [
                                                                                            ["Employment Type", annexureData["gap_validation"]?.employment_fields?.[`employment_${index + 1}`]?.[`employment_type_gap`] || ''],
                                                                                            ["Start Date", annexureData["gap_validation"]?.employment_fields?.[`employment_${index + 1}`]?.[`employment_start_date_gap`] || ''],
                                                                                            ["End Date", annexureData["gap_validation"]?.employment_fields?.[`employment_${index + 1}`]?.[`employment_end_date_gap`] || '']
                                                                                        ];

                                                                                        doc.autoTable({
                                                                                            head: [[{ content: `Employment (${index + 1})`, colSpan: 2, styles: { halign: 'center', fontSize: 12, bold: true } }],
                                                                                            ],
                                                                                            body: employmentFormData,
                                                                                            startY: yPosition,
                                                                                            theme: 'grid',
                                                                                            styles: {
                                                                                                cellPadding: 2,
                                                                                                fontSize: 10
                                                                                            }
                                                                                        });

                                                                                        yPosition = doc.autoTable.previous.finalY + 10;
                                                                                        for (let idx = 0; idx < employGaps.length; idx++) {
                                                                                            const item = employGaps[idx];  // Fix: Use idx directly, not idx - 1


                                                                                            if (item) {
                                                                                                const isNoGap = item.difference.toLowerCase().includes("no") && item.difference.toLowerCase().includes("gap");

                                                                                                const isMatchingEndDate = item.endValue === annexureData["gap_validation"]?.employment_fields?.[`employment_${index}`]?.[`employment_end_date_gap`];

                                                                                                if (isMatchingEndDate) {
                                                                                                    // Prepare the text to be shown in the document
                                                                                                    const textToDisplay = `${isNoGap ? item.difference : `GAP:${item.difference || 'No gap Found'}`}`;

                                                                                                    // Log the text that will be displayed

                                                                                                    // Display the text in the document
                                                                                                    doc.text(
                                                                                                        textToDisplay,
                                                                                                        14,
                                                                                                        doc.autoTable.previous.finalY + 7
                                                                                                    );

                                                                                                    // Update yPosition for next table or text
                                                                                                    yPosition = doc.autoTable.previous.finalY + 10;

                                                                                                }
                                                                                            }
                                                                                        }


                                                                                    });
                                                                                }



                                                                            }
                                                                            else {
                                                                                service.rows.forEach((row, rowIndex) => {
                                                                                    // First: check if any has_not_done checkbox is checked
                                                                                    let skipRow = false;
                                                                                
                                                                                    for (const input of row.inputs) {
                                                                                        if (input.type === 'checkbox' && input.name?.startsWith('has_not_done')) {
                                                                                            const rawValue = annexureData[service.db_table]?.[input.name];
                                                                                            const isChecked = ["1", 1, true, "true"].includes(rawValue ?? false);
                                                                                            if (isChecked) {
                                                                                                skipRow = true;
                                                                                                break; // no need to check more
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                
                                                                                    if (skipRow) return; // Skip this row entirely
                                                                                
                                                                                    // Continue with normal input processing
                                                                                    row.inputs.forEach((input) => {
                                                                                        const isCheckbox = input.type === 'checkbox';
                                                                                        const isDoneCheckbox = isCheckbox && input.name?.startsWith('done_or_not');
                                                                                        const rawValue = annexureData[service.db_table]?.[input.name];
                                                                                        const isChecked = ["1", 1, true, "true"].includes(rawValue ?? false);
                                                                                
                                                                                        if (isDoneCheckbox && !isChecked) return; // Skip done_or_not if not checked
                                                                                        if (input.type === 'file') return; // Skip file inputs
                                                                                
                                                                                        let inputValue;
                                                                                        if (rawValue === 1 || rawValue === "1") {
                                                                                            inputValue = "TRUE";
                                                                                        } else if (rawValue === 0 || rawValue === "0") {
                                                                                            inputValue = "FALSE";
                                                                                        } else if (rawValue === null || rawValue === undefined || rawValue === "") {
                                                                                            inputValue = "N/A";
                                                                                        } else {
                                                                                            inputValue = rawValue;
                                                                                        }
                                                                                
                                                                                        tableData.push([
                                                                                            { content: input.label, styles: { fontStyle: 'bold' } },
                                                                                            inputValue
                                                                                        ]);
                                                                                    });
                                                                                });
                                                                                
                                                                                

                                                                                // Add service heading
                                                                                doc.setFontSize(16);
                                                                                yPosition += 10;

                                                                                doc.autoTable({
                                                                                    startY: yPosition,
                                                                                    head: [
                                                                                        [
                                                                                            {
                                                                                                content: service.heading,
                                                                                                colSpan: 2,
                                                                                                styles: {
                                                                                                    halign: 'left',
                                                                                                    fontSize: 12,
                                                                                                    fontStyle: 'bold',
                                                                                                    fillColor: [197, 217, 241],textColor: [80, 80, 80]
                                                                                                }
                                                                                            }
                                                                                        ]
                                                                                    ],
                                                                                    body: tableData || 'N/A',
                                                                                    theme: 'grid',
                                                                                    margin: { top: 10, horizontal: 10 },
                                                                                    styles: {
                                                                                        fontSize: 10,
                                                                                        cellPadding: 2
                                                                                    }
                                                                                });

                                                                                yPosition = doc.lastAutoTable.finalY + 10; // Update yPosition after table


                                                                                // Process and add images for this service
                                                                                const fileInputs = service.rows.flatMap(row =>
                                                                                    row.inputs.filter(({ type }) => type === "file").map(input => input.name)
                                                                                );

                                                                                if (fileInputs.length > 0) {
                                                                                    const filePromises = fileInputs.map(async (inputName) => {
                                                                                        const annexureFilesStr = annexureData[service.db_table]?.[inputName];
                                                                                        let annexureDataImageHeight = 180; // Reduced image height

                                                                                        if (annexureFilesStr) {
                                                                                            const fileUrls = annexureFilesStr.split(",").map(url => url.trim());
                                                                                            if (fileUrls.length === 0) {
                                                                                                doc.setFont("helvetica", "italic");
                                                                                                doc.setFontSize(10);
                                                                                                doc.setTextColor(150, 150, 150);
                                                                                                doc.text("No annexure files available.", 10, yPosition + 10);
                                                                                                yPosition += 10;
                                                                                                return;
                                                                                            }

                                                                                            const imageUrlsToProcess = fileUrls.filter(url => {
                                                                                                const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
                                                                                                return validImageExtensions.some(ext => url.toLowerCase().endsWith(ext));
                                                                                            });

                                                                                            const nonImageUrlsToProcess = fileUrls.filter(url => {
                                                                                                const validNonImageExtensions = ['pdf', 'xls', 'xlsx'];
                                                                                                return validNonImageExtensions.some(ext => url.toLowerCase().endsWith(ext));
                                                                                            });

                                                                                            // Handle image files
                                                                                            if (imageUrlsToProcess.length > 0) {
                                                                                                const imageBases = await fetchImageToBase(imageUrlsToProcess);
                                                                                                if (imageBases) {
                                                                                                    for (const image of imageBases) {
                                                                                                        if (!image.base64.startsWith('data:image/')) continue;

                                                                                                        doc.addPage();
                                                                                                        yPosition = 20;

                                                                                                        try {
                                                                                                            const pageWidth = doc.internal.pageSize.width;
                                                                                                            const padding = 8;
                                                                                                            const borderX = 10;
                                                                                                            const borderY = yPosition + 20;
                                                                                                            const borderWidth = pageWidth - 20;
                                                                                                            const borderHeight = annexureDataImageHeight;

                                                                                                            // Image position inside border box with padding
                                                                                                            const imageX = borderX + padding;
                                                                                                            const imageY = borderY + padding;
                                                                                                            const imageWidth = borderWidth - padding * 2;
                                                                                                            const imageHeight = borderHeight - padding * 2;

                                                                                                            // Add image
                                                                                                            doc.addImage(image.base64, image.type, imageX, imageY, imageWidth, imageHeight);

                                                                                                            // Add border
                                                                                                            doc.setDrawColor(0); // black
                                                                                                            doc.setLineWidth(0.5);
                                                                                                            doc.rect(borderX, borderY, borderWidth, borderHeight); // x, y, width, height

                                                                                                            yPosition += (borderHeight + 30);
                                                                                                        } catch (error) {
                                                                                                            // console.error(`Error adding image:`, error);
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                            }

                                                                                            // Handle non-image files
                                                                                            const pageHeight = doc.internal.pageSize.height;
                                                                                            const margin = 10;
                                                                                            let lineHeight = 10;

                                                                                            if (nonImageUrlsToProcess.length > 0) {
                                                                                                nonImageUrlsToProcess.forEach(url => {
                                                                                                    if (yPosition + lineHeight > pageHeight - margin) {
                                                                                                        doc.addPage();
                                                                                                        yPosition = margin;
                                                                                                    }

                                                                                                    doc.setFont("helvetica", "normal");
                                                                                                    doc.setFontSize(10);
                                                                                                    doc.setTextColor(255, 0, 0);
                                                                                                    const buttonText = `Click to open the file`;
                                                                                                    const textWidth = doc.getTextWidth(buttonText);
                                                                                                    const centerX = (doc.internal.pageSize.width - textWidth) / 2;

                                                                                                    doc.text(buttonText, centerX, yPosition + 10);
                                                                                                    doc.link(centerX, yPosition + 10, textWidth, 10, { url: url });

                                                                                                    yPosition += lineHeight + 2;
                                                                                                });
                                                                                            }
                                                                                        }
                                                                                    });

                                                                                    await Promise.all(filePromises);
                                                                                }



                                                                            }

                                                                        }
                                                                    }

                                                                    doc.addPage();
                                                                    let newYPosition = 20
                                                                    doc.autoTable({
                                                                        head: [[{ content: 'Declaration and Authorization', colSpan: 2, styles: { halign: 'center', fontSize: 16, bold: true,fillColor: [197, 217, 241],textColor: [80, 80, 80] } }],
                                                                        ], // Table headers
                                                                        body: [
                                                                            [
                                                                                {
                                                                                    content: 'I hereby authorize Screeningstar Solutions Private Limited and its representative to verify information provided in my application for employment and this employee background verification form, and to conduct enquiries as may be necessary, at the company’s discretion. I authorize all persons who may have information relevant to this enquiry to disclose it to Screeningstar Solutions Pvt Ltd or its representative. I release all persons from liability on account of such disclosure. I confirm that the above information is correct to the best of my knowledge. I agree that in the event of my obtaining employment, my probationary appointment, confirmation as well as continued employment in the services of the company are subject to clearance of medical test and background verification check done by the company.',
                                                                                    colSpan: 2, styles: { halign: 'center', fontSize: 9, cellPadding: 5 }
                                                                                }
                                                                            ],
                                                                            ['Name', cefData.name_declaration],
                                                                            ['Date', cefData.declaration_date],
                                                                        ],
                                                                        startY: newYPosition, // Starting Y position
                                                                        margin: { top: 20 }, // Margin for the table
                                                                        theme: 'grid', // You can change the table theme (grid, stripes, etc.)
                                                                    });

                                                                    newYPosition = doc.autoTable.previous.finalY + 20; // Adjusting for space from the last table

                                                                    doc.text("Attach Signature.", doc.internal.pageSize.width / 2, newYPosition, { align: 'center' });

                                                                    const lineHeight = 10;
                                                                    const margin = 10;
                                                                    const DocHeight = 100; // Height for images (adjust as needed)

                                                                    // Check if the signature exists
                                                                    if (cefData && cefData.signature) {
                                                                        // Check if the signature is an image
                                                                        const validImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
                                                                        const isImage = validImageExtensions.some(ext => cefData.signature.toLowerCase().endsWith(ext));

                                                                        if (isImage) {
                                                                            // Fetch the base64 image
                                                                            const imageBases = await fetchImageToBase([cefData.signature]);

                                                                            // Assuming imageBases[0] exists and contains the base64 string
                                                                            if (imageBases && imageBases[0] && imageBases[0].base64) {
                                                                                const imageBase64 = imageBases[0].base64;
                                                                                const imageWidth = doc.internal.pageSize.width - 10; // 20px padding for margins

                                                                                // Add the image to the PDF
                                                                                doc.addImage(imageBase64, 'PNG', 5, newYPosition + 20, imageWidth, DocHeight);
                                                                                newYPosition += DocHeight + 20; // Update the position after the image
                                                                            }
                                                                        } else {
                                                                            // If not an image, show a clickable button to view the document
                                                                            const buttonText = "Click to view attached document";
                                                                            const textWidth = doc.getTextWidth(buttonText);
                                                                            const centerX = (doc.internal.pageSize.width - textWidth) / 2;

                                                                            // Add the text at the center
                                                                            doc.setFont("helvetica", "normal");
                                                                            doc.setFontSize(10);
                                                                            doc.setTextColor(255, 0, 0); // Red color for the button text
                                                                            doc.text(buttonText, centerX + 10, newYPosition + 10);

                                                                            // Create the clickable link to open the document (e.g., cefData.signature could be a URL to the document)
                                                                            doc.link(centerX, newYPosition + 10, textWidth, 10, { url: cefData.signature });

                                                                            // Update the position after the link
                                                                            newYPosition += lineHeight + 20; // Adjust space for next content
                                                                        }
                                                                    } else {
                                                                        // If no signature exists, add a message or alternative content
                                                                        doc.text("No Signature uploaded.", 10, newYPosition + 10);
                                                                        newYPosition += lineHeight + 20; // Adjust space for next content
                                                                    }

                                                                    doc.addPage();

                                                                    doc.setFontSize(14);
                                                                    doc.setFont("helvetica", "bold");
                                                                    const pageWidth = doc.internal.pageSize.width; // Get the page width
                                                                    const textWidth = doc.getTextWidth("Documents (Mandatory)"); // Get the width of the text

                                                                    doc.text("Documents (Mandatory)", (pageWidth - textWidth) / 2, 15); // Center-align text

                                                                    // Define table columns
                                                                    const columns = [
                                                                        { content: "Education", styles: { fontStyle: "bold" } },
                                                                        { content: "Employment", styles: { fontStyle: "bold" } },
                                                                        { content: "Government ID / Address Proof", styles: { fontStyle: "bold" } }
                                                                    ];

                                                                    // Define table rows
                                                                    const rows = [
                                                                        [
                                                                            "Photocopy of degree certificate and final mark sheet of all examinations.",
                                                                            "Photocopy of relieving / experience letter for each employer mentioned in the form.",
                                                                            "Aadhaar Card / Bank Passbook / Passport Copy / Driving License / Voter ID."
                                                                        ]
                                                                    ];

                                                                    // Generate table
                                                                    doc.autoTable({
                                                                        startY: 20,
                                                                        head: [columns],
                                                                        headStyles: {
                                                                            lineWidth: 0.3,
                                                                            fillColor: [197, 217, 241],
                                                                            textColor: [80, 80, 80]

                                                                        },
                                                                        body: rows,
                                                                        styles: { fontSize: 10, cellPadding: 2 },
                                                                        theme: "grid",
                                                                        columnStyles: {
                                                                            0: { halign: "center", minCellWidth: 60 },
                                                                            1: { halign: "center", minCellWidth: 60 },
                                                                            2: { halign: "center", minCellWidth: 60 }
                                                                        }
                                                                    });

                                                                    // Footer Note
                                                                    doc.setFontSize(10);
                                                                    doc.setTextColor(0, 0, 0);
                                                                    doc.setFont("helvetica", "normal");
                                                                    doc.text(
                                                                        "NOTE: If you experience any issues or difficulties with submitting the form, please take screenshots of all pages, including attachments and error messages, and email them to onboarding@screeningstar.in. Additionally, you can reach out to us at onboarding@screeningstar.in.",
                                                                        14,
                                                                        doc.lastAutoTable.finalY + 10,
                                                                        { maxWidth: 180 }
                                                                    );

                                                                    // Save PDF
                                                                    // console.log(`pdfFileName - `, pdfFileName);
                                                                    doc.save(`123.pdf`);

                                                                    // console.log(`targetDirectory - `, targetDirectory);
                                                                    // const pdfPathCloud = await savePdf(
                                                                    //     doc,
                                                                    //     pdfFileName,
                                                                    //     targetDirectory
                                                                    // );
                                                                    resolve(`123.pdf`);
                                                                    // console.log("PDF generation completed successfully.");
                                                                })();
                                                            } catch (error) {
                                                                // console.error("PDF generation error:", error);
                                                                reject(new Error("Error generating PDF"));
                                                            }
                                                        }
                                                    );
                                                }
                                            );
                                        });
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    },
};

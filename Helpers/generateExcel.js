const xl = require("excel4node");
const path = require("path");
const fs = require("fs");
const MyError = require("../ErrorHelpers/MyError");

const excelFolderPath = path.join(
  path.dirname(require.main.filename),
  "tokenFiles"
);

const generateExcelFromArray = async (tokenArray, type) => {
  // Create a new instance of a Workbook class
  const wb = new xl.Workbook();

  // Add Worksheets to the workbook
  const ws = wb.addWorksheet("Sheet 1");

  // Create a reusable style
  const style = wb.createStyle({
    font: {
      color: "black",
      size: 11,
    },
  });

  tokenArray.forEach((token, i) => {
    ws.cell(i + 1, 1)
      .string(`${token}`)
      .style(style);
  });

  const buffer = await wb.writeToBuffer();

  const fileName = `${type}-Tokens-${Date.now()}.xlsx`;
  const excelFilePath = path.join(excelFolderPath, fileName);
  try {
    fs.rmSync(excelFolderPath, {
      force: true,
      recursive: true,
    });
    fs.mkdirSync(excelFolderPath);
    fs.writeFileSync(excelFilePath, buffer);
  } catch (error) {
    throw new MyError(500, "Could not write file to file path.");
  }

  return fileName;
};

module.exports = generateExcelFromArray;

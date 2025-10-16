"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceLineRelations = exports.blueBookEntryRelations = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const blue_book_entries_1 = require("./blue_book_entries");
const invoice_lines_1 = require("./invoice_lines");
exports.blueBookEntryRelations = (0, drizzle_orm_1.relations)(blue_book_entries_1.blueBookEntries, ({ one }) => ({
    invoiceLine: one(invoice_lines_1.invoiceLines, {
        fields: [blue_book_entries_1.blueBookEntries.invoiceLineId],
        references: [invoice_lines_1.invoiceLines.id],
    }),
}));
exports.invoiceLineRelations = (0, drizzle_orm_1.relations)(invoice_lines_1.invoiceLines, ({ one }) => ({
    blueBookEntry: one(blue_book_entries_1.blueBookEntries, {
        fields: [invoice_lines_1.invoiceLines.blueBookId],
        references: [blue_book_entries_1.blueBookEntries.id],
    }),
}));

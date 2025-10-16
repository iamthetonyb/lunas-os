import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  // ... styles
});

export function InvoicePdf({ invoice }: { invoice: any }) {
  return (
    <Document>
      <Page size="A4">
        <View>
          <Text>Invoice</Text>
          {/* Add invoice details here */}
        </View>
      </Page>
    </Document>
  );
}

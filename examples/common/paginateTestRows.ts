import type { INode } from '@lightningjs/renderer';
import { PageContainer } from './PageContainer.js';
import { assertTruthy } from '@lightningjs/renderer/utils';

const HEADER_FONT_SIZE = 30;
const PADDING = 20;

export type RowConstructor = (pageNode: INode) => Promise<INode>;
export type RowContentConstructor = (rowNode: INode) => Promise<number>;

export interface TestRow {
  title: string;
  content: RowContentConstructor;
}

function createPageConstructor(curPageRowConstructors: RowConstructor[]) {
  return async function (
    rowConstructors: RowConstructor[],
    pageNode: INode,
  ): Promise<void> {
    let curY = 0;
    for (const rowConstructor of rowConstructors) {
      const rowNode = await rowConstructor(pageNode);
      rowNode.y = curY;
      curY += rowNode.height;
    }
  }.bind(null, curPageRowConstructors);
}

export async function paginateTestRows(
  pageContainer: PageContainer,
  testRows: TestRow[],
) {
  const renderer = pageContainer.renderer;
  assertTruthy(renderer.root);
  let pageCurY = 0;
  let curPageRowConstructors: RowConstructor[] = [];
  let curRowIndex = 0;
  for (const testRow of testRows) {
    const isLastRow = curRowIndex === testRows.length - 1;
    let newRowConstructor: RowConstructor | null = async (pageNode: INode) => {
      const rowContainer = renderer.createNode({
        x: 0,
        y: pageCurY,
        width: pageContainer.contentWidth,
        height: 0,
        color: 0x00000000,
        parent: pageNode,
      });
      const rowHeaderNode = renderer.createTextNode({
        fontFamily: 'Ubuntu',
        fontSize: HEADER_FONT_SIZE,
        y: PADDING,
        parent: rowContainer,
      });
      const rowNode = renderer.createNode({
        y: HEADER_FONT_SIZE + PADDING * 2,
        width: pageContainer.contentWidth,
        height: 0,
        color: 0x00000000,
        parent: rowContainer,
      });
      const rowHeight = await testRow.content(rowNode);
      rowNode.height = rowHeight;
      rowHeaderNode.text = testRow.title;
      rowContainer.height = HEADER_FONT_SIZE + PADDING * 2 + rowNode.height;
      return rowContainer;
    };
    // Construct the row just to get its height
    const tmpRowContainer = await newRowConstructor(renderer.root);
    // curPageRowConstructors.push(newRowConstructor);
    // If it fits, add it to the current page
    const itFits =
      pageCurY + tmpRowContainer.height <= pageContainer.contentHeight;
    if (itFits) {
      curPageRowConstructors.push(newRowConstructor);
      pageCurY += tmpRowContainer.height;
      newRowConstructor = null;
    }
    // If it doesn't fit OR it's the last row, add the current page to the page container and start a new page
    if (!itFits || isLastRow) {
      const pageConstructor = createPageConstructor(curPageRowConstructors);
      pageContainer.pushPage(pageConstructor);

      pageCurY = tmpRowContainer.height;
      curPageRowConstructors = [];
      if (newRowConstructor) {
        curPageRowConstructors.push(newRowConstructor);
      }

      if (isLastRow && !itFits) {
        const pageConstructor = createPageConstructor(curPageRowConstructors);
        pageContainer.pushPage(pageConstructor);
      }
    }
    tmpRowContainer.parent = null;
    tmpRowContainer.destroy();
    curRowIndex++;
  }
  pageContainer.finalizePages();
}

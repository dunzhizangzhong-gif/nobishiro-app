import { render, waitFor } from '@testing-library/react-native';

import Licenses from '../../../app/settings/licenses';

describe('Licenses (S-11)', () => {
  it('renders without crashing (到達性の確認。実ライセンス一覧生成はrelease-checklist.mdの追跡項目)', async () => {
    const screen = await render(<Licenses />);

    await waitFor(() => expect(screen.getByTestId('licenses-placeholder')).toBeTruthy());
  });
});

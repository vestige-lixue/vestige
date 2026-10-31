[CustomMessages]
english.UninstallDataTitle=Uninstall options
english.UninstallDataDescription=Choose whether to delete your data when uninstalling Vestige.
english.DeleteDataDirectory=Delete the data directory
english.UninstallDataContinue=Uninstall
english.OpenDataDirectoryFailed=Could not open the data directory:%n%1%n%n%2
english.DeleteDataDirectoryFailed=Some data could not be deleted. Close Vestige and remove the remaining files manually:%n%1
chinesesimplified.UninstallDataTitle=卸载选项
chinesesimplified.UninstallDataDescription=选择是否在卸载 Vestige 时同时删除数据。
chinesesimplified.DeleteDataDirectory=删除数据目录
chinesesimplified.UninstallDataContinue=卸载
chinesesimplified.OpenDataDirectoryFailed=无法打开数据目录：%n%1%n%n%2
chinesesimplified.DeleteDataDirectoryFailed=部分数据未能删除。请关闭 Vestige 后手动删除剩余文件：%n%1

[Code]
var
    UninstallDataDirectory: String;
    UninstallConfirmed: Boolean;
    DeleteUninstallData: Boolean;

procedure OpenUninstallDataDirectory(Sender: TObject; const Link: String; LinkType: TSysLinkType);
var
    ErrorCode: Integer;
begin
    if (LinkType = sltID) and (Link = 'data-directory') then
        if not ShellExec('open', UninstallDataDirectory, '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode) then
            MsgBox(FmtMessage(CustomMessage('OpenDataDirectoryFailed'), [UninstallDataDirectory, SysErrorMessage(ErrorCode)]), mbError, MB_OK);
end;

procedure InitializeUninstallProgressForm;
var
    Form: TUninstallProgressForm;
    OptionsPage: TNewNotebookPage;
    DeleteCheckBox: TNewCheckBox;
    DirectoryLink: TNewLinkLabel;
    ContinueButton: TNewButton;
    LinkText, ProgressTitle, ProgressDescription: String;
    ButtonWidth: Integer;
begin
    UninstallDataDirectory := ExpandFileName(ExpandConstant('{userappdata}\Vestige'));
    DeleteUninstallData := False;
    UninstallConfirmed := UninstallSilent;
    if UninstallSilent then
        Exit;

    Form := UninstallProgressForm;
    ProgressTitle := Form.PageNameLabel.Caption;
    ProgressDescription := Form.PageDescriptionLabel.Caption;

    OptionsPage := TNewNotebookPage.Create(Form);
    OptionsPage.Notebook := Form.InnerNotebook;
    OptionsPage.Color := Form.InstallingPage.Color;
    OptionsPage.ParentBackground := Form.InstallingPage.ParentBackground;

    DeleteCheckBox := TNewCheckBox.Create(OptionsPage);
    DeleteCheckBox.Parent := OptionsPage;
    DeleteCheckBox.SetBounds(Form.StatusLabel.Left, Form.StatusLabel.Top, Form.StatusLabel.Width, Form.CancelButton.Height);
    DeleteCheckBox.Anchors := [akLeft, akTop, akRight];
    DeleteCheckBox.Caption := CustomMessage('DeleteDataDirectory');
    DeleteCheckBox.Checked := False;

    LinkText := UninstallDataDirectory;
    StringChangeEx(LinkText, '&', '&&', True);
    DirectoryLink := TNewLinkLabel.Create(OptionsPage);
    DirectoryLink.Parent := OptionsPage;
    DirectoryLink.AutoSize := False;
    DirectoryLink.SetBounds(DeleteCheckBox.Left + ScaleX(20), DeleteCheckBox.Top + DeleteCheckBox.Height + ScaleY(4), DeleteCheckBox.Width - ScaleX(20), ScaleY(20));
    DirectoryLink.Anchors := [akLeft, akTop, akRight];
    DirectoryLink.Caption := '(<a id="data-directory">' + LinkText + '</a>)';
    DirectoryLink.TabStop := True;
    DirectoryLink.UseVisualStyle := True;
    DirectoryLink.OnLinkClick := @OpenUninstallDataDirectory;
    DirectoryLink.AdjustHeight;

    ContinueButton := TNewButton.Create(Form);
    ContinueButton.Parent := Form;
    ContinueButton.Caption := CustomMessage('UninstallDataContinue');
    ContinueButton.ModalResult := mrOk;
    ContinueButton.Default := True;
    ContinueButton.Anchors := [akRight, akBottom];
    ButtonWidth := Form.CalculateButtonWidth([ContinueButton.Caption]);
    ContinueButton.SetBounds(Form.CancelButton.Left - ScaleX(8) - ButtonWidth, Form.CancelButton.Top, ButtonWidth, Form.CancelButton.Height);

    Form.PageNameLabel.Caption := CustomMessage('UninstallDataTitle');
    Form.PageDescriptionLabel.Caption := CustomMessage('UninstallDataDescription');
    Form.InnerNotebook.ActivePage := OptionsPage;
    Form.CancelButton.Enabled := True;
    Form.CancelButton.ModalResult := mrCancel;
    Form.ActiveControl := ContinueButton;

    // Pause the native window before the uninstaller starts removing files.
    UninstallConfirmed := Form.ShowModal = mrOk;
    DeleteUninstallData := UninstallConfirmed and DeleteCheckBox.Checked;
    Form.CancelButton.Enabled := False;
    Form.CancelButton.ModalResult := 0;
    if UninstallConfirmed then
    begin
        Form.InnerNotebook.ActivePage := Form.InstallingPage;
        Form.PageNameLabel.Caption := ProgressTitle;
        Form.PageDescriptionLabel.Caption := ProgressDescription;
        ContinueButton.Free;
        OptionsPage.Free;
    end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
    if (CurUninstallStep = usUninstall) and not UninstallConfirmed then
        Abort;

    if (CurUninstallStep = usPostUninstall) and DeleteUninstallData then
    begin
        if DirExists(UninstallDataDirectory) then
            if not DelTree(UninstallDataDirectory, True, True, True) then
                MsgBox(FmtMessage(CustomMessage('DeleteDataDirectoryFailed'), [UninstallDataDirectory]), mbError, MB_OK);
    end;
end;
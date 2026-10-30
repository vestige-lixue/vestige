[CustomMessages]
english.UninstallDataDescription=Choose whether to delete your data when uninstalling Vestige.
english.DeleteDataDirectory=Delete the data directory
english.UninstallDataContinue=Uninstall
english.OpenDataDirectoryFailed=Could not open the data directory:%n%1%n%n%2
english.DeleteDataDirectoryFailed=Some data could not be deleted. Close Vestige and remove the remaining files manually:%n%1
chinesesimplified.UninstallDataDescription=选择是否在卸载 Vestige 时同时删除数据。
chinesesimplified.DeleteDataDirectory=删除数据目录
chinesesimplified.UninstallDataContinue=卸载
chinesesimplified.OpenDataDirectoryFailed=无法打开数据目录：%n%1%n%n%2
chinesesimplified.DeleteDataDirectoryFailed=部分数据未能删除。请关闭 Vestige 后手动删除剩余文件：%n%1

[Code]
var
    UninstallDataDirectory: String;
    DeleteUninstallData: Boolean;

procedure OpenUninstallDataDirectory(Sender: TObject; const Link: String; LinkType: TSysLinkType);
var
    ErrorCode: Integer;
begin
    if (LinkType = sltID) and (Link = 'data-directory') then
        if not ShellExec('open', UninstallDataDirectory, '', '', SW_SHOWNORMAL, ewNoWait, ErrorCode) then
            MsgBox(FmtMessage(CustomMessage('OpenDataDirectoryFailed'), [UninstallDataDirectory, SysErrorMessage(ErrorCode)]), mbError, MB_OK);
end;

function ShowUninstallDataDialog: Boolean;
var
    Form: TSetupForm;
    Description: TNewStaticText;
    DeleteCheckBox: TNewCheckBox;
    DirectoryLink: TNewLinkLabel;
    ContinueButton, CancelButton: TNewButton;
    LinkText: String;
    ButtonWidth: Integer;
begin
#if VER >= EncodeVer(6, 6, 0)
    Form := CreateCustomForm(520, 180, True, True);
#else
    Form := CreateCustomForm;
    Form.ClientWidth := ScaleX(520);
    Form.ClientHeight := ScaleY(180);
#endif
    try
        Form.Caption := FmtMessage(SetupMessage(msgUninstallAppFullTitle), ['Vestige']);

        Description := TNewStaticText.Create(Form);
        Description.Parent := Form;
        Description.AutoSize := False;
        Description.WordWrap := True;
        Description.SetBounds(ScaleX(20), ScaleY(20), Form.ClientWidth - ScaleX(40), ScaleY(20));
        Description.Caption := CustomMessage('UninstallDataDescription');
        Description.AdjustHeight;

        DeleteCheckBox := TNewCheckBox.Create(Form);
        DeleteCheckBox.Parent := Form;
        DeleteCheckBox.SetBounds(Description.Left, Description.Top + Description.Height + ScaleY(16), Description.Width, ScaleY(23));
        DeleteCheckBox.Caption := CustomMessage('DeleteDataDirectory');
        DeleteCheckBox.Checked := False;

        LinkText := UninstallDataDirectory;
        StringChangeEx(LinkText, '&', '&&', True);
        DirectoryLink := TNewLinkLabel.Create(Form);
        DirectoryLink.Parent := Form;
        DirectoryLink.AutoSize := False;
        DirectoryLink.SetBounds(DeleteCheckBox.Left + ScaleX(20), DeleteCheckBox.Top + DeleteCheckBox.Height + ScaleY(4), Description.Width - ScaleX(20), ScaleY(20));
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

        CancelButton := TNewButton.Create(Form);
        CancelButton.Parent := Form;
        CancelButton.Caption := SetupMessage(msgButtonCancel);
        CancelButton.ModalResult := mrCancel;
        CancelButton.Cancel := True;

        ButtonWidth := Form.CalculateButtonWidth([ContinueButton.Caption, CancelButton.Caption]);
        CancelButton.SetBounds(Form.ClientWidth - ScaleX(20) - ButtonWidth, Form.ClientHeight - ScaleY(43), ButtonWidth, ScaleY(23));
        ContinueButton.SetBounds(CancelButton.Left - ScaleX(8) - ButtonWidth, CancelButton.Top, ButtonWidth, CancelButton.Height);

        Form.ActiveControl := ContinueButton;
        Result := Form.ShowModal = mrOk;
        DeleteUninstallData := Result and DeleteCheckBox.Checked;
    finally
        Form.Free;
    end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
    if CurUninstallStep = usUninstall then
    begin
        UninstallDataDirectory := ExpandFileName(ExpandConstant('{userappdata}\Vestige'));
        DeleteUninstallData := False;
        if not UninstallSilent then
            if not ShowUninstallDataDialog then
                Abort;
    end;

    if (CurUninstallStep = usPostUninstall) and DeleteUninstallData then
    begin
        if DirExists(UninstallDataDirectory) then
            if not DelTree(UninstallDataDirectory, True, True, True) then
                MsgBox(FmtMessage(CustomMessage('DeleteDataDirectoryFailed'), [UninstallDataDirectory]), mbError, MB_OK);
    end;
end;
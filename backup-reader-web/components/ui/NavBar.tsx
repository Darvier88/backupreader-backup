import { FC, useContext, useEffect, useRef } from "react";
import Image from "next/image";

import { Button, Spacer, Grid, Text } from "@nextui-org/react";
import LogoutIcon from "@mui/icons-material/Logout";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { AuthContext, FirestoreContext } from "../../context";
import { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { FirebaseAuth } from "../../config/firebase";
import { ConversationDrawerBtn } from "../buttons";

import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Theme,
  useMediaQuery,
  Typography
} from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { BlockButton } from "../buttons";
import { StorageContext } from "../../context/StorageContext";
import { SystemMessage } from "../alerts";
import { useElements } from "@stripe/react-stripe-js";
import { isWithinTrial } from "../../config/trial";

const styles = {
  navBarStyles: {
    display: "flex",
    width: "100%",
    height: "70px",
    alignItems: "center",
    justifyContent: "start",
    padding: "0px, 20px",
  },
};

type NavBarProps = {
  drawerButtonOnPress: () => void;
};

export const NavBar: FC<NavBarProps> = ({ drawerButtonOnPress }) => {
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { logOut } = useContext(AuthContext);
  const { saveFile } = useContext(StorageContext);
  const { user, getUser, getPlans, clean } = useContext(FirestoreContext);
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
 
  const phone = useMediaQuery(({ breakpoints }: Theme) =>
    breakpoints.down("sm")
  );
  const handleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const changeLanguageHandler = (lang: "en" | "es") => {
    i18n.changeLanguage(lang);
    setAnchorEl(null);
  };

  const onHandleLogout = () => {
    logOut();
    setTimeout(() => {
      clean();
    }, 1000);
  };

  const onHandleSaveFile = (file: any | null) => {

    const maxSize = 200 * 1024 * 1024;

    if (!file) return;
    if(file.size > maxSize){
      alert('Puedes subir hasta conversaciones de 200 Megabytes')
    }else{
      saveFile(file);
    }
  };


  useEffect(() => {
    const handleRedirect = async (userF: User | null) => {
      const createdAt = userF?.metadata.creationTime;

      if( userF ){
        setTimeout(()=>{
          getUser(userF.uid)
        },2000)
        
        getPlans();

        if(createdAt){
          const creationDate = new Date(createdAt);
          const currentDate = new Date();
          const timeDifference = currentDate.getTime() - creationDate.getTime();
          const differenceInDays = Math.floor(timeDifference / (1000 * 3600 * 24));
          setDaysLeft( 15 - differenceInDays )
        }
      }

    }
  
    onAuthStateChanged(FirebaseAuth, handleRedirect);
  
    return;
  }, []);
  

  useEffect(()=>{
    const isAndroid = (): boolean => {
      if (typeof navigator !== 'undefined') {
        return /Android/i.test(navigator.userAgent);
      }
      return false;
    };
    setIsAndroidDevice(isAndroid());
  },[]);


  return (
    <>
      <div
        style={{
          ...styles.navBarStyles,
          backgroundColor: "#0F52BA", //theme?.colors.blue800.value,
          flexDirection: "row",
        }}
      >
        {router.pathname === "/plans" && phone && <Spacer css={{ flex: 1 }} />}

        <Box
          style={
            phone && !user?.plan
              ? { marginLeft: 10 }
              : phone && user
              ? { marginRight: 20 }
              : { marginLeft: 10 }
          }
        >
          <IconButton
            onClick={() =>
              router.pathname === "/dashboard" ||
              router.pathname === "/initialDashboard"
                ? null
                : router.replace("/")
            }
            disableRipple
          >
            <Image alt="" width={211.7246} height={42.4282} src={`/images/backup-reader-logo.png`} />
          </IconButton>
        </Box>
        <Menu
          anchorEl={anchorEl}
          id="basic-menu"
          open={open}
          onClose={() => setAnchorEl(null)}
          MenuListProps={{
            "aria-labelledby": "basic-button",
          }}
        >
          <MenuItem onClick={() => changeLanguageHandler("en")}>
            English ( USA )
          </MenuItem>
          <MenuItem onClick={() => changeLanguageHandler("es")}>
            Español ( Latin America )
          </MenuItem>
        </Menu>
        <Spacer css={{ flex: 1 }} />

        {phone && user && (
          <>
            {
              /*
                <Box marginRight={2.3}>
                  <IconButton
                    aria-label="upload"
                    size="medium"
                    onClick={() =>
                      hiddenFileInput.current ? hiddenFileInput.current.click() : null
                    }
                  >
                    <UploadFileIcon fontSize="medium" style={{ color: "white" }} />
                  </IconButton>
                </Box>
                <input
                  aria-label="file Input"
                  hidden
                  ref={hiddenFileInput}
                  multiple
                  accept=".zip,.rar,.7zip"
                  type="file"
                  onChange={(e) =>
                    onHandleSaveFile(e.target.files ? e.target.files[0] : null)
                  }
                /> 
              */
            }
            <Box marginRight={1}>
              <IconButton
                aria-label="logout"
                size="medium"
                onClick={onHandleLogout}
              >
                <LogoutIcon fontSize="medium" style={{ color: "white" }} />
              </IconButton>
            </Box>
          </>
        )}

        {!user 
        && router.pathname !== "/dashboard" 
        && router.pathname !== "/help" 
        && router.pathname !== "/termsConditions" 
        && router.pathname !== "/privacyPolicy" 
        && (
          <Box marginRight={1}>
            <BlockButton
              navButton
              title={t("Comienza ahora")}
              width={100}
              size={"sm"}
              borderColor={"white"}
              onPress={() => router.push("/auth")}
            />
            {/*<IconButton aria-label="change language" size="medium" onClick={handleMenu}>
                <LanguageIcon fontSize="medium" style={{ color: "white" }} />
              </IconButton>*/}
          </Box>
        )}

        {!phone && user && (
          <>
            {user && (
              <>
                { router.pathname === "/help" ? 
                <Button
                    css={{ color: "white" }}
                    light
                    auto
                    onPress={() => router.push("/dashboard")}
                  >
                    {t("Chats")}
                  </Button>
                : null}

                { router.pathname === "/dashboard" ? 
                  <>
                  {
                    /*
                      <Button
                    css={{ color: "white" }}
                    light
                    auto
                    onPress={() =>
                      hiddenFileInput.current
                        ? hiddenFileInput.current.click()
                        : null
                    }
                  >
                    {t("Subir Chat")}
                  </Button>  
                    */
                  }
                  
                  <input
                    aria-label="file Input"
                    hidden
                    ref={hiddenFileInput}
                    multiple
                    accept=".zip,.rar,.7zip"
                    type="file"
                    onChange={(e) =>
                      onHandleSaveFile(e.target.files ? e.target.files[0] : null)
                    }
                  /></>
                : null}
                
                {/*<Button
                  css={{ color: "white" }}
                  light
                  auto
                  onPress={() => router.push("/account")}
                >
                  {"Mi cuenta"}
                </Button>*/}
                <Box marginRight={1}>
                  <Button
                    css={{ color: "white" }}
                    light
                    auto
                    onPress={onHandleLogout}
                  >
                    {t("Cerrar sesión")}
                  </Button>
                </Box>
                <Box marginRight={1}>
                  <BlockButton
                    navButton
                    title={t("Ayuda")}
                    width={100}
                    size={"sm"}
                    borderColor={"white"}
                    onPress={() => router.push("/help")}
                  />
                </Box>
              </>
            )}
          </>
        )}
      </div>
      {
        (!user?.plan && isWithinTrial(daysLeft)) && router.pathname == '/dashboard' ?
          <Grid xs={12}>
            <SystemMessage 
              image="/images/alert.svg"
              text={t("Tienes")+" "+daysLeft +" "+t("días de prueba gratuitos")}
              alt="Imagen de alerta para recordarte que tu tiempo de prueba está por concluir"
              width={36}
              height={36}
            />
        </Grid>
      : null
      }

      {
        router.pathname == '/dashboard' && phone && (
          <>
            <Box marginBottom={2}>
                <ConversationDrawerBtn
                  drawerButtonOnPress={()=> drawerButtonOnPress()}
                />
              </Box>
            <Spacer css={{ flex: 1 }} />
          </>
        )}

    </>
  );
};


// window.dev_server = 0;
const getElements = async (selector, waitSeconds = 2) => {
    let timeTaken = 0;
    return new Promise((resolve, reject) => {
        let interval = setInterval(() => {
            timeTaken += 0.5;
            let elements = document.querySelectorAll(selector);
            if (elements?.length) {
                clearInterval(interval);
                resolve(elements);
            } else if (timeTaken >= waitSeconds) {
                clearInterval(interval)
                resolve([]);
            }
        }, 500);
    });
}
const getElement = async (selector, waitSeconds = 2) => {
    let timeTaken = 0;
    return new Promise((resolve, reject) => {
        let interval = setInterval(() => {
            timeTaken += 0.5;
            let element = document.querySelector(selector);
            if (element?.length) {
                clearInterval(interval);
                resolve(element);
            } else if (timeTaken >= waitSeconds) {
                clearInterval(interval)
                resolve(null);
            }
        }, 500);
    });
}
// const getTheme = async () => { 
//     return new Promise((resolve, reject) => {
//         frappe.call({
//             method: "frappe_theme.api.get_my_theme",
//             freeze: true,
//             callback: async function (response) {
//                 if(response?.message || response){
//                     resolve(response?.message || response)
//                 }else{
//                     reject('No message in response');
//                 }
//             },
//             // freeze_message: __("Getting theme...")
//         });
//     })
// }

const getTheme = async () => {
    try {
        const response = await fetch('/api/method/frappe_theme.api.get_my_theme', {
            method: 'GET',
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        return data?.message || data || 'No message in response';
    } catch (error) {
        throw new Error(error.message || 'Error fetching theme');
    }
};

const getUserRoles = (theme) => {
    let currentUser = frappe?.boot?.user?.roles;
    if (!currentUser) {
        return false;
    }
    if (currentUser.includes('Administrator')) {
        if (theme.hide_search.map(u => u.role).includes('Administrator')) {
            return true;
        } else {
            return false;
        }
    }
    let roles = currentUser.some(role => theme.hide_search.some(u => u.role === role))
    if (!roles) {
        return false;
    }
    return roles;
}
const observer_function = async (theme) => {
    const targetNode = document.documentElement;
    const config = {
        childList: true,
        subtree: true,
    };
    const observer = new MutationObserver(async (mutationsList) => {
        for (let _ of mutationsList) {
            // console.log('///////');
            if (theme.table_hide_like_comment_section == 1) {
                await hide_comments_and_like_from_list();
            }
        }
    });

    observer.observe(targetNode, config);
}
const hide_comments_and_like_from_list = async () => {
    var elementsToRemove = document.querySelectorAll('header div.level-right,div.level-right.text-muted');
    if (elementsToRemove && elementsToRemove.length > 0 && cur_list) {
        elementsToRemove.forEach((element) => {
            if (element) {
                element.remove();
            }
        })
        let pageArea = document.querySelector('.list-paging-area.level div.level-left')
        var counts = document.createElement('p');
        let count_string = await cur_list.get_count_str();
        counts.innerHTML = `<span id="custom_count_renderer">0 of 0</span>`;
        if (pageArea && pageArea.childElementCount == 1) {
            var loadMoreButton = pageArea.children[0];
            pageArea.insertBefore(counts, loadMoreButton);
        }
        if (count_string) {
            document.querySelector('#custom_count_renderer').innerText = count_string;
        }
    }
}
const addCustomLogo = () => {
    const navbarBreadcrumbs = document.querySelector('#navbar-breadcrumbs');
    const logoUrl = frappe.boot.my_theme?.custom_logo;

    if (navbarBreadcrumbs && logoUrl) {
        const customLogo = document.createElement('div');
        customLogo.className = 'custom-logo';

        const logoHeight = frappe.boot.my_theme?.custom_logo_height || 36;

        customLogo.innerHTML = `
            <img src="${logoUrl}" alt="Custom Logo" style="height: ${logoHeight}px; margin-right: 15px;">
        `;
        navbarBreadcrumbs.parentNode.insertBefore(customLogo, navbarBreadcrumbs);
    }
}
const applyTheme = async () => {
    let theme = frappe.boot?.my_theme || await getTheme();
    const style = document.createElement('style');
    style.innerHTML = `
        /* Login page */
        #page-login {
            background: ${theme.page_background_type && theme.page_background_type == 'Color' ? `${theme.login_page_background_color}` : theme.page_background_type == 'Image' ? theme.login_page_background_image && `url("${theme.login_page_background_image}")` : 'transparent'} !important;
            background-size: cover !important;
            height: 100vh !important;
        }
        .btn-primary.btn-login {
            background-color: ${theme.login_button_background_color && theme.login_button_background_color} !important;
            color: ${theme.login_button_text_color && theme.login_button_text_color} !important;
        }
        .btn-primary.btn-login:hover {
            background-color: ${theme.login_page_button_hover_background_color && theme.login_page_button_hover_background_color} !important;
            color: ${theme.login_page_button_hover_text_color && theme.login_page_button_hover_text_color} !important;
        }
        div.level-left p{
            padding-top: 8px;
            padding-right: 8px;
        }
        
        .form-control{
            background-color: ${theme.input_background_color && theme.input_background_color} !important;
            color: ${theme.input_text_color && theme.input_text_color} !important;
            border: 2px solid ${theme.input_border_color && theme.input_border_color} !important;
        }
        label.control-label{
            color: ${theme.input_label_color && theme.input_label_color} !important;
        }
        .for-login {
            position: ${theme.login_box_position !== 'Default' ? 'absolute' : 'static'};
            right: ${theme.login_box_position === 'Right' ? '10%' : ''};
            left: ${theme.login_box_position === 'Left' ? '10%' : ''};
            top:${theme.is_app_details_inside_the_box == 1 ? '26%' : '18%'};
            background-color:${theme.is_app_details_inside_the_box == 1 && (theme.login_box_background_color ? theme.login_box_background_color : '#ffff')} !important;
            border-radius:${theme.is_app_details_inside_the_box == 1 && '10px'} !important;
        }
        .login-content.page-card{
            padding: ${theme.is_app_details_inside_the_box == 1 ? '18px 40px 40px 40px' : (theme.login_box_position !== 'Default' ? '40px' : '')} !important;
            width:${theme.login_box_position !== 'Default' ? '450px' : ''} !important;
            background-color: ${theme.login_box_background_color && theme.login_box_background_color} !important;
            border: 2px solid ${theme.login_box_background_color && theme.login_box_background_color} !important;
        }
        .login-content{
            border:${theme.is_app_details_inside_the_box == 1 && 'none'} !important;
        }
        .for-login .page-card-head h4{
            display: ${theme.login_page_title && 'none'} !important;
        }
        .for-login .page-card-head:after{
            display:${theme.login_page_title && 'flex'} !important;
            justify-content:${theme.login_page_title && 'center'} !important;
            margin-top:${theme.login_page_title && '10px'} !important;
            content:${theme.login_page_title && `'${theme.login_page_title}'`} !important;
            color:${theme.login_page_title && theme.page_heading_text_color} !important;
        }
        .page-card-head h4 {
            color: ${theme.page_heading_text_color && theme.page_heading_text_color} !important;
        }
    
        @media (max-width: 768px) {
            .for-login {
                position: static;
            }
            .login-content.page-card{
                width: auto !important;
                padding: auto auto;
            }
        }


        /* Navbar */
        .input-group.search-bar.text-muted {
           display: ${getUserRoles(theme) ? 'none' : ''} !important;
        }
     
        .navbar {
            background-color: ${theme.navbar_color && theme.navbar_color} !important;
        }
        .navbar.container ,.navbar-brand{
            color: ${theme.navbar_text_color && theme.navbar_text_color} !important;
        }
        .navbar-nav svg{
            fill: ${theme.navbar_text_color && theme.navbar_text_color} !important;
            stroke: ${theme.navbar_text_color && theme.navbar_text_color} !important;
        }
        .navbar-toggler , .navbar-toggler span svg,.navbar svg.es-icon.icon-sm use, .notifications-seen > .es-icon{
            fill:${theme.navbar_text_color && theme.navbar_text_color} !important;
            stroke-width: 0;
        }
        #navbar-breadcrumbs li a::before {
            content: '›';
        }
        button.navbar-toggler{
            border-color:${theme.navbar_text_color && theme.navbar_text_color} !important;
        }
        #navbar-breadcrumbs li a{
            color: ${theme.navbar_text_color && theme.navbar_text_color} !important;
        }
        #navbar-breadcrumbs li.disabled a{
            color: ${(theme.navbar_color && theme.navbar_text_color) ? theme.navbar_text_color : theme.navbar_color && '#56373F'} !important;
        }
        .btn-reset.nav-link span{
            color:${theme.hide_help_button == 0 && (theme.navbar_text_color && theme.navbar_text_color)} !important;
        }
        .btn-reset.nav-link span svg{
            stroke:${theme.hide_help_button == 0 && (theme.navbar_text_color && theme.navbar_text_color)} !important;
        }
        .d-lg-block,
        .d-sm-block {
            display: ${theme.hide_help_button == 1 && 'none'} !important;
        }

        /* Primary Btn */
        .btn-primary, .btn-primary:active{
            background-color: ${theme.button_background_color && theme.button_background_color} !important;
        }
        .btn-primary span, .btn-primary:active span{
            color: ${theme.button_text_color && theme.button_text_color} !important;
        }
        .btn-primary:hover{
            background-color: ${theme.button_hover_background_color && theme.button_hover_background_color} !important;
        }
        .btn-primary:hover span{
            color: ${theme.button_hover_text_color && theme.button_hover_text_color} !important;
        }

        /* main Contant*/
        body{
            background-color: ${theme.body_background_color && theme.body_background_color} !important;
        }
        .content.page-container{
            background-color: ${theme.body_background_color && theme.body_background_color} !important;
        }
        .page-head {
            background-color: ${theme.body_background_color && theme.body_background_color} !important;
        }
        .layout-main-section, .row.form-section.card-section.visible-section{
            background-color: ${theme.main_body_content_box_background_color && theme.main_body_content_box_background_color} !important;
            border-radius: 10px!important;
        }
        @media(min-width: 992px) {
            [data-page-route=Workspaces].layout-main.layout-main-section.edit-mode {
                background-color: ${theme.main_body_content_box_background_color && theme.main_body_content_box_background_color} !important;
            }
        }
        .desk-sidebar-item.standard-sidebar-item.selected,.desk-sidebar-item.standard-sidebar-item.selected span{
            background-color: ${theme.secondary_button_background_color && theme.secondary_button_background_color} !important;
            color: ${theme.secondary_button_text_color && theme.secondary_button_text_color} !important;
        }
        .desk-sidebar-item.standard-sidebar-item:hover,.desk-sidebar-item.standard-sidebar-item:hover span{
            background-color: ${theme.secondary_button_hover_background_color && theme.secondary_button_hover_background_color} !important;
            color: ${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
        }
        .btn.btn-default.ellipsis, .btn-default , .btn-default:active{
            background-color: ${theme.secondary_button_background_color && theme.secondary_button_background_color} !important;
            color: ${theme.secondary_button_text_color && theme.secondary_button_text_color} !important; s
        }
        .btn.btn-default.ellipsis:hover, .btn-default:hover{
            background-color: ${theme.secondary_button_hover_background_color && theme.secondary_button_hover_background_color} !important;
            color: ${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
        }
        .btn.btn-secondary.btn-default svg{
            stroke:${theme.secondary_button_text_color && theme.secondary_button_text_color} !important;
            fill:${theme.secondary_button_text_color && theme.secondary_button_text_color} !important;
        }
        .btn.btn-secondary svg{
            stroke:${theme.secondary_button_text_color && theme.secondary_button_text_color} !important;
            fill:${theme.secondary_button_text_color && theme.secondary_button_text_color} !important;
        }
        .btn.btn-default svg{
            stroke:${theme.secondary_button_text_color && theme.secondary_button_text_color} !important;
            fill:${theme.secondary_button_text_color && theme.secondary_button_text_color} !important;
        }
        .btn.btn-secondary.btn-default:hover svg{
            stroke:${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
            fill:${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
        }
        .btn.btn-secondary:hover svg{
            stroke:${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
            fill:${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
        }
        .btn.btn-default:hover svg{
            stroke:${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
            fill:${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
        }
        .btn.btn-default.icon-btn span .menu-btn-group-label svg,.btn.btn-secondary.btn-default:hover svg{
            stroke:${theme.secondary_button_hover_text_color && theme.secondary_button_hover_text_color} !important;
        }
        .page-form.flex{
            background-color: ${theme.main_body_content_box_background_color && theme.main_body_content_box_background_color} !important;
        }
        .widget{
            background-color: ${theme.main_body_content_box_background_color && theme.main_body_content_box_background_color} !important;
        }

        /* table */
        .level.list-row-head.text-muted{
            background-color: ${theme.table_head_background_color && theme.table_head_background_color} !important;
        }
        .level-left.list-header-subject, span.level-item,div.level-right{
            color: ${theme.table_head_text_color && theme.table_head_text_color} !important;
        }
        div.level-right span.level-item.list-liked-by-me span svg use.like-icon{
            stroke:${theme.table_head_text_color && theme.table_head_text_color} !important;
        }
        
        .level.list-row,.level-item.bold.ellipsis a,.filterable.ellipsis{
            background-color:${theme.table_body_background_color && theme.table_body_background_color} !important;
            color: ${theme.table_body_text_color && theme.table_body_text_color} !important;
            margin-top: 1px !important;
        }
        div.level-item.list-row-activity{
            color: ${theme.table_body_text_color && theme.table_body_text_color} !important;
        }
        .level-item.list-row-activity span.list-row-like span svg.es-icon.es-line.icon-sm use,.level-item.list-row-activity span.comment-count svg.es-icon.es-line.icon-sm use{
            stroke:${theme.table_body_text_color && theme.table_body_text_color} !important;
        }
        
        .level-right{
            background-color: none!important;
        }

        /* Widgets */
        .widget.number-widget-box{
            background-color: ${theme.number_card_background_color && theme.number_card_background_color} !important;
            border: 2px solid ${theme.number_card_border_color ? theme.number_card_border_color : '#EDEDED'} !important;
        }
        .widget-head, .widget-label, .widget-title, .widget-body,.widget-content div.number{
            color: ${theme.number_card_text_color && theme.number_card_text_color} !important;
        }   
    `;
    await observer_function(theme);
    document.head.appendChild(style);
    addCustomLogo();
}
applyTheme()

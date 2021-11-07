namespace WatchIt.Domain.Models;
using Microsoft.AspNetCore.Identity;
using System.Collections.Generic;

public class ApplicationUser : IdentityUser
{
    public IEnumerable<Like> Likes { get; set; }

}
